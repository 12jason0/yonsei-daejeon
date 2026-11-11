import { checkPassword, configured, json, loginCookie, sameOrigin } from '../lib/auth.mjs';

export async function POST(req) {
  if (!configured()) return json({ error: '아직 설정 중이에요' }, 503);
  if (!sameOrigin(req)) return json({ error: '잘못된 요청이에요' }, 403);
  const body = await req.json().catch(() => null);
  if (!checkPassword(body?.password)) {
    await new Promise(r => setTimeout(r, 1000));   // 틀리면 1초 늦게
    return json({ error: '비밀번호가 맞지 않아요' }, 401);
  }
  return json({ ok: true }, 200, { 'set-cookie': loginCookie() });
}
