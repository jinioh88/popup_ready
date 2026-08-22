/// <reference types="vite/client" />

/**
 * `VITE_` 접두 환경변수는 번들에 그대로 실린다 — 클라이언트 공개 키만 둔다.
 * 시크릿 키(토스 시크릿, 백엔드 자격증명 등)는 절대 넣지 않는다.
 */
interface ImportMetaEnv {
  /** Kakao Maps JavaScript 키 (US-101). 각자 발급해 로컬 `.env`에 둔다. */
  readonly VITE_KAKAO_MAP_KEY?: string;
  /** API 오리진. 비우면 같은 오리진으로 요청한다(개발 중에는 MSW가 가로챈다). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
