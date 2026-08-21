# PopupReady

팝업스토어 공간 예약·운영 플랫폼 모노레포. 백엔드/웹/모바일 앱을 하나의 GitHub 저장소에서 관리합니다.

## 저장소 구조

```
PopupReady/
├── backend/     # Spring Boot API 서버 (Java 21, Gradle)
│                #   JPA · Spring Security(JWT) · Spring Batch(다자간 정산)
│                #   Redisson(분산 락 - 이중 예약 방지) · PostGIS(위치 기반 검색)
├── web/         # React + TypeScript 웹 클라이언트 (Vite)
│                #   React-Konva(2D 가상 빌더) · Zustand · TanStack Query
│                #   Kakao Maps(공간 탐색) · Tailwind + shadcn/ui(대시보드)
├── mobile/      # React Native (Expo) 현장 운영 앱
│                #   expo-camera(바코드 스캔) · mqtt.js(도어락 모킹)
│                #   Expo Router · Zustand · TanStack Query
├── infra/       # 로컬 개발 인프라 (docker-compose)
│                #   PostgreSQL+PostGIS · Redis · Mosquitto(MQTT 브로커)
├── docs/        # 기획 문서 (PRD, MVP 백로그, 기술스택, 페르소나, 사용자흐름도)
└── .github/
    └── workflows/  # CI (backend / web / mobile 별 파이프라인)
```

## 각 프로젝트 생성 방법

각 하위 프로젝트는 아래 명령으로 해당 디렉토리에 직접 생성합니다.

### backend — Spring Boot

[start.spring.io](https://start.spring.io)에서 생성 (Gradle, Java 21, 패키지 `com.popupready`)
의존성: Web, Data JPA, Security, Validation, Batch, Data Redis, PostgreSQL, Flyway, Lombok, Actuator
> 참고: start.spring.io는 현재 Spring Boot 4.x만 지원합니다(3.x는 지원 종료 수순). 문서의 3.x 스택과 구조는 동일합니다.
> 추가 수동 의존성: `redisson-spring-boot-starter`, `hibernate-spatial`(PostGIS), `jjwt`(JWT)

### web — React + TypeScript

```bash
npm create vite@latest web -- --template react-ts   # 린터: ESLint 선택
cd web
npm i react-router @tanstack/react-query zustand \
      konva react-konva react-kakao-maps-sdk \
      react-hook-form zod @hookform/resolvers recharts \
      @tosspayments/tosspayments-sdk
npm i -D tailwindcss @tailwindcss/vite vitest @testing-library/react
```

| 영역 | 선택 | 용도 |
|---|---|---|
| 빌드/기반 | Vite + React + TypeScript | SPA (로그인 기반 빌더·대시보드 중심) |
| 라우팅 | React Router | 브랜드/건물주/관리자 역할별 라우트 |
| 서버 상태 | TanStack Query | 공간 목록·예약·정산 API 캐싱/재조회 |
| 클라이언트 상태 | Zustand | 빌더 캔버스 상태 (집기 배치, 면적·전력 합산) |
| 2D 캔버스 | React-Konva | 그리드 스냅 빌더, 드래그 앤 드롭, 충돌 감지 |
| 지도 | Kakao Maps SDK | 공실 상가 반경 검색 (국내 주소/좌표) |
| UI | Tailwind CSS + shadcn/ui | 대시보드 테이블·모달·폼 |
| 폼/검증 | React Hook Form + Zod | 입점 신청·계약·정산 계좌 폼 |
| 차트 | Recharts | 성과 대시보드 (mAsh 목업 데이터) |
| 결제 | 토스페이먼츠 위젯 SDK | PG 결제창 연동 |
| 테스트 | Vitest + Testing Library | 계산 로직·컴포넌트 테스트 |

> SEO 판단: 공간 탐색 페이지의 검색 유입이 중요해지면 Next.js 고려 대상이나,
> MVP는 SPA로 시작하고 필요 시 마케팅 페이지만 분리하는 것이 현실적.

### mobile — React Native (Expo)

저장소 루트에서 실행:

```bash
npx create-expo-app@latest mobile --template blank-typescript
cd mobile
npx expo install expo-router expo-camera expo-secure-store react-native-webview
npm i @tanstack/react-query zustand mqtt react-hook-form zod @hookform/resolvers \
      @tosspayments/widget-sdk-react-native
```

> 네이티브 모듈은 `npm i`가 아닌 `npx expo install`로 설치 (Expo SDK 호환 버전 자동 선택)

| 영역 | 선택 | 용도 |
|---|---|---|
| 기반 | Expo + TypeScript | 네이티브 빌드 설정 없이 개발 |
| 라우팅 | Expo Router | 파일 기반 라우팅 (Expo 표준) |
| 서버 상태 | TanStack Query | 예약 조회·비품 결제 API (웹과 공유) |
| 클라이언트 상태 | Zustand | 스캔 장바구니, 도어락 상태 (웹과 공유) |
| 바코드 스캔 | expo-camera | 비품 스캔 → 추가 결제 |
| MQTT | mqtt.js (WebSocket :9001) | 도어락 모킹 신호 송출, Expo Go에서 동작 |
| 결제 | 토스페이먼츠 RN SDK | 현장 추가 결제창 |
| 토큰 보관 | expo-secure-store | JWT를 Keychain/Keystore에 저장 |
| 폼/검증 | React Hook Form + Zod | 웹과 공유 |
| 테스트 | Jest + RN Testing Library | Expo 기본 프리셋 |

> **Expo Go 우선 원칙:** MVP 동안은 Expo Go만으로 개발 가능하게 설계할 것.
> 도어락을 실제 BLE 대신 MQTT 모킹으로 처리하는 백로그 스코프 덕분에,
> 위 구성은 네이티브 커스텀 빌드 없이 Expo Go 앱에서 전부 돌아간다(개발 속도 최상).
> 나중에 실제 BLE 도어락을 붙이는 시점에만 `react-native-ble-plx` +
> development build(`expo-dev-client`)로 전환하면 된다.

## 로컬 인프라 실행

```bash
cd infra && docker compose up -d
# PostgreSQL+PostGIS :5432 / Redis :6379 / MQTT :1883 (ws :9001)
```
