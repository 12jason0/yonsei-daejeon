// 사이트 내용(공지·가격표·진료 시간) 검사와 저장소.
// 저장소: BLOB_READ_WRITE_TOKEN 있으면 Vercel Blob, LOCAL_CONTENT=1 이면 .local-content/ 폴더, 둘 다 없으면 없음(seed만).
// Blob은 같은 경로를 덮어쓰면 최대 60초 옛날 내용이 읽힐 수 있어서, 저장할 때마다 새 경로(content/저장시각.json)로 쓰고 가장 최근 파일을 읽는다.
import { readFileSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { put, list, del } from '@vercel/blob';

const PREFIX = 'content/';
const KEEP = 30;   // 최근 30개만 남김 (백업 역할)
const LOCAL_DIR = new URL('../.local-content/', import.meta.url);

export const seed = () => JSON.parse(readFileSync(new URL('../content/seed.json', import.meta.url), 'utf8'));

export function storeMode() {
  if (process.env.BLOB_READ_WRITE_TOKEN) return 'blob';
  if (process.env.LOCAL_CONTENT === '1') return 'local';
  return 'none';
}

// 가장 최근에 저장된 내용. 저장된 게 없으면 null. 읽기 실패는 throw (빌드를 멈추게)
export async function readLatest() {
  const mode = storeMode();
  if (mode === 'blob') {
    const blobs = await listBlobs();
    if (!blobs.length) return null;
    const res = await fetch(blobs[0].url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Blob 읽기 실패: ${res.status} ${blobs[0].pathname}`);
    return res.json();
  }
  if (mode === 'local') {
    const names = await listLocal();
    if (!names.length) return null;
    return JSON.parse(await readFile(new URL(names[0], LOCAL_DIR), 'utf8'));
  }
  return null;
}

export async function saveContent(content) {
  const name = content.savedAt.replace(/[:.]/g, '-') + '.json';   // 2026-11-11T01-02-03-456Z.json (글자순 = 시간순)
  const body = JSON.stringify(content, null, 2);
  const mode = storeMode();
  if (mode === 'blob') {
    await put(PREFIX + name, body, { access: 'public', addRandomSuffix: false, contentType: 'application/json' });
    const old = (await listBlobs()).slice(KEEP);
    if (old.length) await del(old.map(b => b.url));
  } else if (mode === 'local') {
    await mkdir(LOCAL_DIR, { recursive: true });
    await writeFile(new URL(name, LOCAL_DIR), body);
    for (const n of (await listLocal()).slice(KEEP)) await unlink(new URL(n, LOCAL_DIR));
  } else {
    throw new Error('저장소가 설정되지 않았어요');
  }
}

async function listBlobs() {   // 최신 먼저
  const out = [];
  let cursor;
  do {
    const r = await list({ prefix: PREFIX, cursor });
    out.push(...r.blobs.filter(b => b.pathname.endsWith('.json')));
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  return out.sort((a, b) => (a.pathname < b.pathname ? 1 : -1));
}

async function listLocal() {   // 최신 먼저
  try { return (await readdir(LOCAL_DIR)).filter(n => n.endsWith('.json')).sort().reverse(); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
}

// ---- 검사: 모르는 값은 버리고, 잘못된 값은 쉬운 말로 throw ----
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const mins = t => +t.slice(0, 2) * 60 + +t.slice(3);

function text(v, label, max, required = true) {
  const s = String(v ?? '').replace(/\r\n?/g, '\n').trim();
  if (required && !s) throw new Error(`${label}을(를) 써 주세요`);
  if (s.length > max) throw new Error(`${label}이(가) 너무 길어요 (${max}자까지)`);
  return s;
}
const oneLine = (v, label, max, required) => text(v, label, max, required).replace(/\s*\n\s*/g, ' ');

export function normalize(c) {
  if (!c || typeof c !== 'object') throw new Error('내용이 비어 있어요');

  if (!Array.isArray(c.notices) || c.notices.length > 500) throw new Error('공지사항 목록이 이상해요');
  const ids = new Set();
  const notices = c.notices.map(n => {
    const id = Number(n?.id);
    if (!Number.isInteger(id) || id < 1 || ids.has(id)) throw new Error('공지 번호가 이상해요. 새로고침 후 다시 해 주세요');
    ids.add(id);
    const title = oneLine(n.title, '공지 제목', 200);
    const date = String(n.date ?? '');
    if (!DATE.test(date) || Number.isNaN(Date.parse(date))) throw new Error(`"${title}" 공지의 날짜를 다시 골라 주세요`);
    return { id, title, date, pinned: n.pinned === true, body: text(n.body, '공지 내용', 20000, false) };
  });
  const maxId = Math.max(0, ...ids);
  const nextNoticeId = Math.max(Number.isInteger(c.nextNoticeId) ? c.nextNoticeId : 0, maxId + 1);

  const p = c.prices;
  if (!p || !Array.isArray(p.groups) || p.groups.length > 100) throw new Error('가격표가 이상해요');
  const groups = p.groups.map(g => {
    const name = oneLine(g?.name, '묶음 이름', 100);
    if (!Array.isArray(g.items) || !g.items.length) throw new Error(`"${name}" 묶음에 줄이 하나도 없어요. 줄을 추가하거나 묶음을 지워 주세요`);
    if (g.items.length > 100) throw new Error(`"${name}" 묶음의 줄이 너무 많아요`);
    return {
      name,
      note: oneLine(g.note, '묶음 설명', 200, false),
      items: g.items.map(it => ({
        name: oneLine(it?.name, `"${name}"의 항목 이름`, 200),
        note: oneLine(it?.note, '항목 설명', 300, false),
        price: oneLine(it?.price, `"${name}"의 가격`, 100),
      })),
    };
  });
  if (!Array.isArray(p.notes) || p.notes.length > 50) throw new Error('표 아래 안내 문구가 이상해요');
  const notes = p.notes.map(s => oneLine(s, '안내 문구', 500, false).replace(/^\*\s*/, '')).filter(Boolean);

  const h = c.hours || {};
  const t = k => { const v = String(h[k] ?? ''); if (!TIME.test(v)) throw new Error('진료 시간을 모두 골라 주세요'); return v; };
  const hours = {
    weekdayOpen: t('weekdayOpen'), weekdayClose: t('weekdayClose'),
    lunchStart: t('lunchStart'), lunchEnd: t('lunchEnd'),
    satOpen: t('satOpen'), satClose: t('satClose'),
    closedDays: oneLine(h.closedDays, '쉬는 날', 50),
    closedNote: oneLine(h.closedNote, '쉬는 날 덧붙임', 50, false),
    cutoffMinutes: Number(h.cutoffMinutes),
    skinWeekdayStart: t('skinWeekdayStart'), skinWeekdayEnd: t('skinWeekdayEnd'),
    skinSatStart: t('skinSatStart'), skinSatEnd: t('skinSatEnd'),
  };
  const order = (a, b, msg) => { if (mins(hours[a]) >= mins(hours[b])) throw new Error(msg); };
  order('weekdayOpen', 'weekdayClose', '평일 진료가 끝나는 시간이 시작 시간보다 늦어야 해요');
  order('lunchStart', 'lunchEnd', '점심시간 끝이 시작보다 늦어야 해요');
  order('weekdayOpen', 'lunchStart', '점심시간은 평일 진료 시간 안에 있어야 해요');
  order('lunchEnd', 'weekdayClose', '점심시간은 평일 진료 시간 안에 있어야 해요');
  order('satOpen', 'satClose', '토요일 진료가 끝나는 시간이 시작 시간보다 늦어야 해요');
  order('skinWeekdayStart', 'skinWeekdayEnd', '평일 피부 시술 예약 시간을 다시 골라 주세요');
  order('skinSatStart', 'skinSatEnd', '토요일 피부 시술 예약 시간을 다시 골라 주세요');
  if (!Number.isInteger(hours.cutoffMinutes) || hours.cutoffMinutes < 1 || hours.cutoffMinutes > 120) throw new Error('접수 마감은 1분에서 120분 사이로 써 주세요');

  const savedAt = typeof c.savedAt === 'string' && !Number.isNaN(Date.parse(c.savedAt)) ? c.savedAt : null;
  return { savedAt, nextNoticeId, notices, prices: { groups, notes }, hours };
}
