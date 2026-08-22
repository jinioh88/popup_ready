/**
 * Access 토큰 보관 — **localStorage 채택 (PM 승인 2026-08-22)**.
 *
 * XSS 노출 경로라는 점은 인지하고 MVP 수용 범위로 확정했다. httpOnly 쿠키 전환은 스코프 외다.
 * Refresh 토큰은 Sprint 2 범위이므로 여기서 다루지 않는다.
 *
 * SPA 모드는 빌드 타임에 `/`를 렌더하므로 브라우저 밖에서도 호출될 수 있다 — 접근 전에 항상
 * `window` 존재를 확인한다.
 */

const ACCESS_TOKEN_KEY = "popupready.accessToken";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    // 프라이빗 모드·저장소 차단 환경에서는 접근 자체가 throw한다. 비로그인으로 취급한다.
    return null;
  }
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch {
    // 저장에 실패해도 현재 세션은 메모리상 응답으로 계속 진행할 수 있다.
  }
}

export function clearAccessToken(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  } catch {
    // 삭제 실패는 무시한다 — 이후 요청이 401로 걸러진다.
  }
}
