/// <reference types="vite/client" />

/**
 * `VITE_` 접두 환경변수는 번들에 그대로 실린다 — 클라이언트 공개 키만 둔다.
 * 시크릿 키(토스 시크릿, 백엔드 자격증명 등)는 절대 넣지 않는다.
 */
interface ImportMetaEnv {
  /** Kakao Maps JavaScript 키 (US-101). 각자 발급해 로컬 `.env`에 둔다. */
  readonly VITE_KAKAO_MAP_KEY?: string;
  /** API 오리진. 비우면 같은 오리진으로 요청한다(dev 서버가 `/api`를 백엔드로 프록시). */
  readonly VITE_API_BASE_URL?: string;
  /** `"false"`면 MSW 목업을 끄고 실제 백엔드로 요청한다. 기본값은 목업 사용. */
  readonly VITE_USE_MOCK_API?: string;
  /** dev 서버가 `/api`를 넘길 백엔드 주소. 기본 `http://localhost:8080`. */
  readonly VITE_API_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
