// 빌드: 최신 내용(Blob → 없으면 seed)을 index.html 표시 주석 자리에 넣어 dist/로 출력
// - Blob 토큰 없음 / Blob 비어 있음 → content/seed.json
// - Blob 토큰 있는데 읽기 실패 → 빌드 실패 (이전 배포가 그대로 살아 있게)
import { readFile, writeFile, rm, mkdir, cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { normalize, readLatest, seed, storeMode } from '../lib/content.mjs';
import { render } from '../lib/render.mjs';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);

export async function build({ quiet = false } = {}) {
  const latest = await readLatest();
  const content = normalize(latest ?? seed());
  const html = render(await readFile(new URL('index.html', root), 'utf8'), content);

  await rm(dist, { recursive: true, force: true });
  await mkdir(dist);
  await writeFile(new URL('index.html', dist), html);
  await cp(new URL('img/', root), new URL('img/', dist), { recursive: true });
  await cp(new URL('admin/', root), new URL('admin/', dist), { recursive: true });
  await cp(new URL('robots.txt', root), new URL('robots.txt', dist));
  await cp(new URL('sitemap.xml', root), new URL('sitemap.xml', dist));
  await writeFile(new URL('version.json', dist), JSON.stringify({ savedAt: content.savedAt }));
  if (!quiet) console.log(`빌드 완료: ${latest ? `저장본 ${content.savedAt}` : 'seed.json'} (저장소: ${storeMode()})`);
  return content;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  build().catch(e => { console.error('빌드 실패:', e.message); process.exit(1); });
}
