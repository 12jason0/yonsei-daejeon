// 관리 화면 로그인: 비밀번호 하나(ADMIN_PASSWORD), 쿠키는 SESSION_SECRET으로 서명, 30일 유지
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { storeMode } from './content.mjs';

const COOKIE = 'yonsei_admin';
const MAX_AGE = 30 * 24 * 60 * 60;
const env = () => ({ pw: process.env.ADMIN_PASSWORD || '', secret: process.env.SESSION_SECRET || '' });

// 비밀번호·서명 키·저장소·(Blob이면) Deploy Hook까지 다 있어야 관리 화면을 연다
export function configured() {
  const { pw, secret } = env();
  const mode = storeMode();
  return !!(pw && secret && (mode === 'local' || (mode === 'blob' && process.env.DEPLOY_HOOK_URL)));
}

// 비밀번호를 바꾸면 기존 로그인도 다 풀리게 비밀번호도 서명에 넣음
const sign = exp => createHmac('sha256', env().secret).update(`${exp}|${env().pw}`).digest('base64url');
const sha = s => createHash('sha256').update(String(s)).digest();   // 길이를 같게 맞춰 timing-safe 비교

export const checkPassword = pw => typeof pw === 'string' && timingSafeEqual(sha(pw), sha(env().pw));

export function loginCookie() {
  const exp = Date.now() + MAX_AGE * 1000;
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Strict`;
}
export const logoutCookie = () => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;

export function isLoggedIn(req) {
  if (!configured()) return false;
  const m = (req.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)\\.([\\w-]+)`));
  if (!m || +m[1] < Date.now()) return false;
  const a = Buffer.from(m[2]), b = Buffer.from(sign(m[1]));
  return a.length === b.length && timingSafeEqual(a, b);
}

// 저장 요청이 우리 사이트 화면에서 온 것인지 (주소 하드코딩 없이 요청받은 주소와 비교)
export function sameOrigin(req) {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  let host;
  try { host = new URL(origin).host; } catch { return false; }
  return [new URL(req.url).host, req.headers.get('x-forwarded-host'), req.headers.get('host')].includes(host);
}

export const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', ...headers },
});
