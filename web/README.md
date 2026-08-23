# PopupReady Web

브랜드 운영자용 웹 클라이언트. **지도 기반 공실 탐색(US-101) → 2D 그리드 스냅 빌더(US-102) → 실시간 전력·면적 부하 연산(US-103) → 예약·계약·대시보드**를 담당한다.

- 스택: React 19 · TypeScript · **React Router 8 프레임워크 모드(SPA, `ssr: false`)** · Vite 8 · Tailwind 4
- 주요 라이브러리: TanStack Query(서버 상태) · Zustand(빌더 캔버스 상태) · React Hook Form + Zod(폼) · React-Konva(2D 빌더) · react-kakao-maps-sdk(지도) · 토스페이먼츠 SDK(결제) · Recharts(대시보드)
- 개발 지침은 [`CLAUDE.md`](./CLAUDE.md), 라우팅·빌드 구조 결정 근거는 [`../docs/기술스택.md`](../docs/기술스택.md) §2, 스프린트 작업 지시는 [`../docs/tasks/`](../docs/tasks/) 참조.

## 사전 준비

- Node.js 24 이상 (개발 환경 기준 v24.6.0, npm 11)
- 백엔드 API(`http://localhost:8080`)와 로컬 인프라 — **필요하다.** 목업(MSW)은 실 API 통합이 끝나면서
  제거됐으므로(2026-08-23), 백엔드가 없으면 화면은 뜨지만 데이터 구간이 전부 실패한다.

```bash
cd ../infra && docker compose up -d   # PostgreSQL+PostGIS / Redis / MQTT
cd ../backend && ./gradlew bootRun    # :8080
```

개발 서버는 `/api` 요청을 백엔드로 프록시한다(`vite.config.ts`). 브라우저에서 보면 같은 오리진이라
CORS 설정 없이 붙고, 배포 시 정적 산출물과 API를 같은 오리진 뒤에 두는 구성과 모양이 같다.

시드 계정으로 바로 로그인할 수 있다 — `brand@popupready.com` / `password123`
(비밀번호는 BRAND·LANDLORD·VENDOR·ADMIN 4개 역할 공통). 예약 생성은 BRAND 역할만 허용된다.

## 실행

```bash
npm install
npm run dev        # 개발 서버 (http://localhost:5173)
```

## 명령

| 명령 | 설명 |
|---|---|
| `npm run dev` | 개발 서버(HMR). 실행 중 라우트 타입이 자동 생성된다 |
| **`npm run verify`** | **typecheck → lint → vitest run. 커밋 전 이 한 줄을 돌린다** |
| `npm run build` | 프로덕션 빌드. **타입 검사는 하지 않는다** |
| `npm run typecheck` | `react-router typegen && tsc -b` |
| `npm run lint` | ESLint |
| `npm test` | 테스트 (watch) |
| `npx vitest run <파일>` | 단일 파일 실행 |
| `npx vitest run -t "<이름>"` | 단일 케이스 실행 |
| `npm run format` | Prettier로 코드 포맷 자동 교정 |

## 품질 게이트

- 사람·CI가 **같은 명령(`npm run verify`)**을 쓴다. 실패 로그를 그대로 원인 분석에 넘기기 위해서다.
- CI: [`.github/workflows/web-ci.yml`](../.github/workflows/web-ci.yml) — `web/**` 변경 시 `npm run verify` + `npm run build` 실행.
- **빌드 실패 조건은 타입 오류·lint 오류·테스트 실패로 한정한다.** 코드 스타일은 Prettier가 자동 교정하며 빌드를 깨지 않는다.

> `app/routes.ts`나 라우트 모듈을 추가·수정한 뒤 `dev` 서버를 띄우지 않은 상태라면, `./+types/*` 타입이 없어 IDE·`tsc`가 실패한다. `npm run typecheck`를 한 번 돌리면 생성된다.

## 환경 변수

Vite 규약에 따라 `VITE_` 접두가 붙은 값만 클라이언트에 주입된다. `web/.env`에 작성하고, **`.env.example`에는 키 이름만 커밋한다(값 금지)**.

| 키 | 용도 |
|---|---|
| `VITE_KAKAO_MAP_KEY` | Kakao Maps JavaScript 키 (각자 발급). 없으면 지도가 리스트 폴백으로 동작한다 |
| `VITE_API_BASE_URL` | API 오리진. **비워 두는 것이 기본** — 같은 오리진으로 요청하고 dev 서버가 `/api`를 프록시한다 |
| `VITE_API_PROXY_TARGET` | dev 서버가 `/api`를 넘길 백엔드 주소 (기본 `http://localhost:8080`) |

## 디렉터리 구조

```
web/
├── app/                  # 애플리케이션 코드 (src/ 아님)
│   ├── root.tsx          # 진입점 — 전역 레이아웃·Provider·ErrorBoundary·HydrateFallback
│   ├── routes.ts         # 라우트 선언 (@react-router/dev/routes)
│   ├── routes/           # 라우트 모듈
│   └── app.css           # @import "tailwindcss";
├── public/               # 정적 자산
├── react-router.config.ts # ssr: false (SPA 모드)
├── vite.config.ts        # [tailwindcss(), reactRouter()]
├── .react-router/        # 자동 생성 타입 (git 무시)
└── build/client/         # 빌드 산출물 = 배포 대상
```

루트 `index.html`은 없다. 진입점은 `app/root.tsx`이며, SPA 모드에서 빌드 시 `/`가 렌더되어 `build/client/index.html`로 저장된다.

## 빌드·배포

```bash
npm run build
```

정적 배포 대상은 **`build/client`** (`dist`가 아니다). `build/server/`는 빌드 중간 산출물이라 배포 대상이 아니다. SPA이므로 호스팅 측에 **모든 경로 → `index.html` 폴백**을 설정한다(S3/CloudFront 또는 nginx `try_files`).

## 알아둘 제약

- **`ssr: false`를 임의로 바꾸지 않는다** — 정적 배포 전제가 깨진다. 전환은 PM 승인 사항이며 재검토 트리거는 `../docs/기술스택.md` §2에 정리돼 있다.
- **서버 `loader`/`action`을 쓰지 않는다.** 데이터 페칭은 TanStack Query로 통일한다(이중 캐시 방지 + 모바일과 API 클라이언트 공유).
- `@vitejs/plugin-react`를 추가하지 않는다 — `reactRouter()` 플러그인에 babel 변환·Fast Refresh가 포함돼 중복이다.
- Tailwind 4에는 `tailwind.config.js`가 없다. 테마 확장은 CSS의 `@theme`로 한다.
- 백엔드 API 규약: prefix `/api/v1`, 응답 봉투 `{ "data": ..., "error": null }`, 인증은 JWT Bearer.
- 빌더의 **점유 셀 계산식은 백엔드 서버측 재검증과 동일해야 한다**(`ceil(width_mm / cellSizeMm) × ceil(depth_mm / cellSizeMm)`, 90/270도 회전 시 폭·깊이 스왑). 한쪽만 고치면 정상 배치가 400으로 거절된다. 2026-08-23 실서버 맞대결로 일치를 확인했다(`docs/tasks/sprint1-web.md` §7).
- **그리드(`gridCols`·`gridRows`·`cellSizeMm`)는 상수로 박지 않는다.** 공간마다 다르고(10×7 ~ 24×14), 요청 레이아웃이 `GET /spaces/{id}` 값과 다르면 서버가 400으로 물린다.
