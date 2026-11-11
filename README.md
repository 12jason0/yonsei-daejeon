# 연세의원 홈페이지

정적 HTML 한 장(`index.html`) + 원장님용 관리 화면(`/admin`).
GitHub `main`에 push하면 Vercel이 자동으로 배포합니다.

> **공지·가격·진료 시간은 관리 화면(Vercel Blob)이 원본입니다.**
> `content/seed.json`이나 `index.html`의 해당 부분을 고쳐도 사이트는 바뀌지 않습니다.
> seed.json은 Blob이 비어 있거나 토큰이 없을 때만 씁니다.

## 구조

```
index.html          사이트 원본 틀. 바뀌는 자리는 <!-- @이름 --> … <!-- /@이름 --> 로 감쌈
content/seed.json   처음 내용 (Blob이 비어 있을 때 사용)
admin/index.html    관리 화면 (휴대폰용, 스크립트 한 장)
api/                Vercel 함수: session, login, logout, content
lib/content.mjs     내용 검사 + 저장소 (Blob / 로컬 폴더)
lib/render.mjs      표시 주석 자리에 내용 넣기 (전부 이스케이프)
lib/auth.mjs        비밀번호·쿠키·Origin 확인
scripts/build.mjs   빌드 → dist/
scripts/dev.mjs     로컬 테스트 서버
```

흐름: 관리 화면에서 저장 → Blob `content/저장시각.json`에 새 파일로 저장(최근 30개 보관)
→ Deploy Hook 호출 → Vercel 재빌드 → `build.mjs`가 가장 최근 파일을 읽어 `index.html`의 표시 주석 자리에 넣고 `dist/`로 출력
→ `dist/version.json`의 저장 시각을 관리 화면이 확인해서 “반영됐어요” 표시.

- Blob은 같은 경로를 덮어쓰면 최대 60초 옛날 내용이 읽힐 수 있어서, 저장할 때마다 새 경로를 씁니다.
- 빌드 규칙: Blob 토큰 없음 또는 Blob 비어 있음 → seed.json / 토큰은 있는데 읽기 실패 → **빌드 실패** (이전 배포 유지)
- 표시 주석이 하나라도 없거나 짝이 안 맞으면 빌드 실패.
- 환경변수가 없으면 빌드는 seed로 성공하고, 관리 화면은 “아직 설정 중이에요”만 보여 줍니다.
- 사이트는 자바스크립트 없이도 다 보이고, `#notice-8` 같은 페이지 이동은 CSS `:target` 그대로입니다.
- 가격표 위 “○년 ○월 기준”은 `prices.updated`. 저장할 때 가격표 내용이 실제로 바뀌었으면 서버가 그 달(한국 시간)로 바꿈.
- 진료과목의 “시술 후 주의사항 보기”는 8번 공지에 고정. 8번을 지우면 링크도 빠지고, 공지 번호는 다시 쓰지 않습니다.

### 환경변수 (Vercel)

| 이름 | 내용 |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | Blob 저장소를 프로젝트에 연결하면 자동으로 생김 |
| `DEPLOY_HOOK_URL` | Deploy Hook 주소 (main) |
| `ADMIN_PASSWORD` | 관리 화면 비밀번호. 바꾸면 로그인된 기기도 모두 풀림 |
| `SESSION_SECRET` | 로그인 쿠키 서명용 랜덤 값 |

## 로컬 테스트

이 PC는 Vercel CLI(`vercel dev`)가 안 되므로 직접 만든 서버를 씁니다.

```bash
npm install
npm run dev        # http://localhost:58690 , 관리 화면 http://localhost:58690/admin
```

- 포트 58690은 네이버 지도에 등록된 주소라 바꾸지 마세요.
- `.env.local`이 있으면 읽습니다. `ADMIN_PASSWORD`가 없으면 비밀번호는 `local-test`.
- Blob 토큰이 없으면 `.local-content/` 폴더에 저장하고, 저장하면 Deploy Hook 대신 바로 다시 빌드합니다.
- 처음 상태로 되돌리려면 `.local-content/` 폴더를 지우세요.

빌드만 하기: `npm run build` → `dist/`

seed로 빌드한 결과는 `index.html`과 글자 하나까지 같아야 합니다:

```bash
npm run build && cmp index.html dist/index.html && echo 같음
```
