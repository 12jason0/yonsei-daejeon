// 로컬 테스트 서버 (vercel dev 대신): dist/ + /api/*, 포트 58690
// - .env.local 있으면 읽음. Blob 토큰 없으면 .local-content/ 폴더에 저장
// - 저장(POST /api/content)이 성공하면 Deploy Hook 대신 바로 다시 빌드
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { extname } from 'node:path';

const root = new URL('../', import.meta.url);
const PORT = 58690;

if (existsSync(new URL('.env.local', root))) process.loadEnvFile(new URL('.env.local', root));
if (!process.env.BLOB_READ_WRITE_TOKEN) process.env.LOCAL_CONTENT = '1';
if (!process.env.ADMIN_PASSWORD) { process.env.ADMIN_PASSWORD = 'local-test'; console.log('비밀번호(로컬 테스트용): local-test'); }
process.env.SESSION_SECRET ||= randomBytes(32).toString('hex');

const { build } = await import('./build.mjs');
await build();

const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.js': 'text/javascript', '.css': 'text/css' };
const NOINDEX = { 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store' };

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const api = url.pathname.match(/^\/api\/([a-z]+)$/);
    if (api) {
      const mod = await import(`../api/${api[1]}.js`).catch(() => null);
      const fn = mod?.[req.method];
      if (!fn) { res.writeHead(mod ? 405 : 404).end(); return; }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
      const r = await fn(new Request(url, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined }));
      if (api[1] === 'content' && req.method === 'POST' && r.ok) await build();   // Deploy Hook 대신
      const out = Object.fromEntries(r.headers);
      if (r.headers.getSetCookie().length) out['set-cookie'] = r.headers.getSetCookie();
      res.writeHead(r.status, out).end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith('/')) path += 'index.html';
    else if (path === '/admin') path = '/admin/index.html';
    if (path.includes('..')) { res.writeHead(400).end(); return; }
    const file = await readFile(new URL('dist' + path, root)).catch(() => null);
    if (!file) { res.writeHead(404).end('404'); return; }
    const extra = path.startsWith('/admin') || path === '/version.json' ? NOINDEX : {};
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream', ...extra }).end(file);
  } catch (e) {
    console.error(e);
    res.writeHead(500).end('서버 오류');
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}  (관리 화면: http://localhost:${PORT}/admin)`));
