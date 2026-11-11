// index.html 안의 <!-- @이름 --> … <!-- /@이름 --> 사이만 내용으로 바꿔 넣는다.
// 표시 주석이 줄 맨 앞에 혼자 있으면 '여러 줄' 자리(들여쓰기 맞춰 줄 단위), 아니면 '한 줄 안' 자리.
// 표시 주석이 하나라도 없거나, 모르는 이름이거나, 짝이 안 맞으면 throw.

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---- 시간 표기 (자리마다 지금 쓰는 표기 그대로) ----
const hm = t => [+t.slice(0, 2), +t.slice(3)];
const ampm = t => (hm(t)[0] < 12 ? '오전' : '오후');
const h12 = t => hm(t)[0] % 12 || 12;
const mm = t => String(hm(t)[1]).padStart(2, '0');
const clock = t => `${ampm(t)} ${h12(t)}:${mm(t)}`;                    // 오전 9:00
const bare = t => `${h12(t)}시` + (hm(t)[1] ? ` ${hm(t)[1]}분` : '');   // 12시 30분
const ko = t => `${ampm(t)} ${bare(t)}`;                               // 오후 6시
const h24 = t => `${hm(t)[0]}:${mm(t)}`;                               // 18:00
const sameHalf = (a, b) => ampm(a) === ampm(b);
const clockShort = (a, b) => `${clock(a)} ~ ${sameHalf(a, b) ? `${h12(b)}:${mm(b)}` : clock(b)}`;   // 오후 12:30 ~ 1:30
const koRange = (a, b) => `${ko(a)}~${sameHalf(a, b) || b === '12:00' ? bare(b) : ko(b)}`;           // 오전 9시~12시, 오전 9시~오후 4시
const minus = (t, m) => { const x = hm(t)[0] * 60 + hm(t)[1] - m; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
const eunNeun = w => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? '은' : '는'; };

// ---- 공지 ----
export const sortNotices = ns => [...ns].sort((a, b) => (b.pinned - a.pinned) || (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id));

// 글자만 받음. 빈 줄 = 문단, '1. '로 시작하는 줄만 모인 문단 = 번호 목록, 문단 안 줄바꿈 = <br>
function bodyLines(body) {
  const out = [];
  for (const para of body.split(/\n\s*\n/)) {
    const lines = para.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines.every(l => /^\d+\.\s/.test(l))) {
      const start = parseInt(lines[0], 10);
      out.push(start === 1 ? '<ol>' : `<ol start="${start}">`);
      for (const l of lines) out.push(`  <li>${esc(l.replace(/^\d+\.\s+/, ''))}</li>`);
      out.push('</ol>');
    } else {
      out.push(`<p>${lines.map(esc).join('<br>')}</p>`);
    }
  }
  return out;
}

const RIGHT = '<svg class="ic ic-s"><use href="#i-right"/></svg>';

// 이름 → [여러 줄 자리인지, 만드는 함수]
const SLOTS = {
  'strip-hours': [true, ({ hours: h }) => [
    `<span>평일 <b>${ko(h.weekdayClose)}</b>까지 진료</span><i></i>`,
    `<span>토요일 <b>${ko(h.satClose)}</b>까지</span><i></i>`,
  ]],
  'faq-hours': [false, ({ hours: h }) =>
    `평일은 ${ko(h.weekdayOpen)}부터 ${ko(h.weekdayClose)}까지(점심시간 ${bare(h.lunchStart)}~${bare(h.lunchEnd)}), 토요일은 ${ko(h.satClose)}까지 진료합니다. 진료 끝나기 ${h.cutoffMinutes}분 전에 접수를 마감해요.`],
  'skin-hours': [false, ({ hours: h }) =>
    `평일 ${koRange(h.skinWeekdayStart, h.skinWeekdayEnd)}, 토요일 ${koRange(h.skinSatStart, h.skinSatEnd)}`],
  'home-hours': [true, ({ hours: h }) => [
    '<dl class="hours">',
    `  <div><dt>평일</dt><dd>${clock(h.weekdayOpen)} ~ ${clock(h.weekdayClose)}</dd></div>`,
    `  <div><dt>토요일</dt><dd>${clock(h.satOpen)} ~ ${clock(h.satClose)} <small>(점심시간 없음)</small></dd></div>`,
    `  <div><dt>점심시간</dt><dd>${clock(h.lunchStart)} ~ ${clock(h.lunchEnd)} <small>(평일)</small></dd></div>`,
    `  <div><dt>접수마감</dt><dd>진료 끝나기 ${h.cutoffMinutes}분 전</dd></div>`,
    '</dl>',
    `<p class="hours-note">* ${esc(h.closedDays)}${h.closedNote ? `(${esc(h.closedNote)})` : ''}${eunNeun(h.closedDays)} 휴진합니다</p>`,
  ]],
  'hours-table': [true, ({ hours: h }) => [
    `<tr><td class="day">월요일 ~ 금요일</td><td class="time">${clock(h.weekdayOpen)} ~ ${clock(h.weekdayClose)}</td><td class="etc">점심시간 ${clockShort(h.lunchStart, h.lunchEnd)}</td></tr>`,
    `<tr><td class="day">토요일</td><td class="time">${clock(h.satOpen)} ~ ${clock(h.satClose)}</td><td class="etc">점심시간 없음</td></tr>`,
    `<tr class="off"><td class="day">${esc(h.closedDays.replace(/\s*·\s*/g, ' · '))}</td><td class="time">휴진</td><td class="etc">${esc(h.closedNote)}</td></tr>`,
  ]],
  'cutoff-info': [false, ({ hours: h }) =>
    `진료 끝나기 ${h.cutoffMinutes}분 전까지 접수해 주세요. 평일 ${clock(minus(h.weekdayClose, h.cutoffMinutes))}, 토요일 ${clock(minus(h.satClose, h.cutoffMinutes))}까지입니다.`],
  'loc-hours': [false, ({ hours: h }) =>
    `평일 ${clock(h.weekdayOpen)} ~ ${clock(h.weekdayClose)}<small>토요일 ${clock(h.satClose)}까지 · ${esc(h.closedDays)} 휴진</small>`],
  'call-hours': [false, ({ hours: h }) =>
    `평일 ${h24(h.weekdayOpen)}~${h24(h.weekdayClose)} (점심 ${h24(h.lunchStart)}~${h24(h.lunchEnd)})<br>토요일 ${h24(h.satOpen)}~${h24(h.satClose)} · ${esc(h.closedDays)} 휴진`],

  'mini-notices': [true, ({ notices }) => sortNotices(notices).slice(0, 4).map(n =>
    `<li><a href="#notice-${n.id}"><span class="t">${esc(n.title)}</span><time datetime="${n.date}">${n.date}</time></a></li>`)],
  'notice-count': [false, ({ notices }) => String(notices.length)],
  'notice-rows': [true, ({ notices }) => {
    const list = sortNotices(notices);
    if (!list.length) return ['<tr><td class="subj" colspan="3">등록된 공지사항이 없습니다.</td></tr>'];
    let no = list.filter(n => !n.pinned).length;
    return list.map(n => `<tr${n.pinned ? ' class="pin"' : ''}><td class="no">${n.pinned ? '<span class="pin-tag">공지</span>' : no--}</td><td class="subj"><a href="#notice-${n.id}">${esc(n.title)}</a><span class="m-date">${n.date}</span></td><td class="date">${n.date}</td></tr>`);
  }],
  'notice-posts': [true, ({ notices }) => sortNotices(notices).flatMap(n => [
    `<article class="post" id="notice-${n.id}">`,
    `  <div class="post-head"><h2>${esc(n.title)}</h2><p>작성일 ${n.date}</p></div>`,
    '  <div class="post-body">',
    ...bodyLines(n.body).map(l => '    ' + l),
    '  </div>',
    '  <div class="post-foot"><a class="btn btn-outline" href="#notice">목록</a></div>',
    '</article>',
  ])],
  // 진료과목 '시술 후 주의사항 보기'는 8번 공지 고정. 8번이 지워지면 링크도 안 보임
  'care-notice-link': [false, ({ notices }) =>
    notices.some(n => n.id === 8) ? `<a class="more-link" href="#notice-8">시술 후 주의사항 보기${RIGHT}</a>` : ''],

  'prices': [true, ({ prices }) => prices.groups.flatMap(g => g.items.map((it, i) => {
    const cat = i ? '' : `<td class="cat"${g.items.length > 1 ? ` rowspan="${g.items.length}"` : ''}>${esc(g.name)}${g.note ? `<small>${esc(g.note)}</small>` : ''}</td>`;
    return `<tr>${cat}<td>${esc(it.name)}${it.note ? `<small>${esc(it.note)}</small>` : ''}</td><td class="won">${esc(it.price)}</td></tr>`;
  }))],
  'price-notes': [false, ({ prices }) => prices.notes.map(s => `* ${esc(s)}`).join('<br>')],
};

export const SLOT_NAMES = Object.keys(SLOTS);

export function render(template, content) {
  const eol = template.includes('\r\n') ? '\r\n' : '\n';
  const seen = new Set();
  const out = template.replace(/<!-- @([a-z0-9-]+) -->([\s\S]*?)<!-- \/@\1 -->/g, (all, name, _inner, offset) => {
    const slot = SLOTS[name];
    if (!slot) throw new Error(`모르는 표시 주석: @${name}`);
    seen.add(name);
    const lineStart = template.lastIndexOf('\n', offset - 1) + 1;
    const indent = template.slice(lineStart, offset);
    const block = /^[ \t]*$/.test(indent) && /^\r?\n/.test(_inner);
    const [isBlock, fn] = slot;
    if (isBlock !== block) throw new Error(`@${name} 표시 주석 위치가 이상해요 (${isBlock ? '줄 맨 앞에 혼자 있어야 함' : '한 줄 안에 있어야 함'})`);
    const v = fn(content);
    const inner = isBlock ? eol + v.map(l => indent + l + eol).join('') + indent : v;
    return `<!-- @${name} -->${inner}<!-- /@${name} -->`;
  });
  const missing = SLOT_NAMES.filter(n => !seen.has(n));
  if (missing.length) throw new Error(`index.html에 표시 주석이 없어요: ${missing.map(n => '@' + n).join(', ')}`);
  const stray = out.replace(/<!-- @([a-z0-9-]+) -->[\s\S]*?<!-- \/@\1 -->/g, '').match(/<!-- \/?@[a-z0-9-]+ -->/);
  if (stray) throw new Error(`짝이 안 맞는 표시 주석: ${stray[0]}`);
  return out;
}
