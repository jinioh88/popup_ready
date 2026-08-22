/**
 * 로그인 후 되돌아갈 경로 검증.
 *
 * 인증 가드가 원래 목적지를 라우터 state로 실어 보내는데, 그 값을 검사 없이 이동 대상으로 쓰면
 * **열린 리다이렉트**가 된다(`//evil.example`은 프로토콜 상대 URL이라 외부로 나간다).
 * 우리 앱 내부 경로만 허용한다.
 */
export const DEFAULT_LANDING = "/spaces";

export function safeRedirectPath(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_LANDING;
  }

  // 반드시 "/"로 시작하되, "//" 와 "/\"(브라우저가 "//"로 해석)는 외부로 나갈 수 있어 막는다.
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return DEFAULT_LANDING;
  }

  // 로그인·가입 화면으로 되돌리면 순환한다.
  if (value === "/login" || value === "/signup") {
    return DEFAULT_LANDING;
  }

  return value;
}
