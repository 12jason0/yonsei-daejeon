// GET: 지금 내용 (저장본 없으면 seed) / POST: 저장 → Deploy Hook 호출
import { isLoggedIn, json, sameOrigin } from '../lib/auth.mjs';
import { normalize, readLatest, saveContent, seed } from '../lib/content.mjs';

export async function GET(req) {
  if (!isLoggedIn(req)) return json({ error: '다시 로그인해 주세요' }, 401);
  return json({ content: normalize((await readLatest()) ?? seed()) });
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const thisMonthKST = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 7);   // 2026-11

export async function POST(req) {
  if (!isLoggedIn(req)) return json({ error: '다시 로그인해 주세요' }, 401);
  if (!sameOrigin(req)) return json({ error: '잘못된 요청이에요' }, 403);
  if (+(req.headers.get('content-length') || 0) > 1_000_000) return json({ error: '내용이 너무 길어요' }, 413);
  const body = await req.json().catch(() => null);

  // 기준 날짜는 화면이 보낸 값을 안 믿고, 가격이 실제로 바뀌었을 때만 이번 달로
  if (body?.content?.prices) body.content.prices.updated = '2000-01';
  let content;
  try { content = normalize(body?.content); }
  catch (e) { return json({ error: e.message }, 400); }

  // 다른 기기에서 먼저 저장했으면 덮어쓰지 않음
  const latest = await readLatest();
  if ((latest?.savedAt ?? null) !== (body.baseSavedAt ?? null)) {
    return json({ error: '다른 곳에서 먼저 저장한 내용이 있어요. 화면을 새로고침한 뒤 다시 고쳐 주세요' }, 409);
  }

  const before = normalize(latest ?? seed()).prices;
  const { updated: _, ...nowPrices } = content.prices;
  const { updated: prevUpdated, ...prevPrices } = before;
  content.prices.updated = sameJson(nowPrices, prevPrices) ? prevUpdated : thisMonthKST();

  content.savedAt = new Date().toISOString();
  await saveContent(content);

  let deployed = true;
  if (process.env.DEPLOY_HOOK_URL) {
    deployed = await fetch(process.env.DEPLOY_HOOK_URL, { method: 'POST' }).then(r => r.ok, () => false);
  }
  return json({ savedAt: content.savedAt, deployed });
}
