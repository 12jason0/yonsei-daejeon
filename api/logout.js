import { json, logoutCookie, sameOrigin } from '../lib/auth.mjs';

export function POST(req) {
  if (!sameOrigin(req)) return json({ error: '잘못된 요청이에요' }, 403);
  return json({ ok: true }, 200, { 'set-cookie': logoutCookie() });
}
