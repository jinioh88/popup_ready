/**
 * 인증 세션의 순수 로직 — T0 인증 가드(지시서 §5).
 *
 * React·Expo 무의존(src/lib 규칙). 판정만 하고 저장·라우팅은 하지 않는다.
 */

/**
 * 세 번째 상태 `loading`이 이 게이트의 핵심이다.
 *
 * SecureStore 읽기는 비동기라 첫 프레임에는 토큰이 아직 없다. 이때 두 상태(있음/없음)로만
 * 판정하면 둘 중 하나로 반드시 틀린다 — 비관적으로 보면 정상 로그인 사용자가 로그인 화면으로
 * 튕기고, 낙관적으로 보면 가드가 없는 것과 같다. 그래서 "아직 모른다"를 상태로 만든다.
 */
export type AuthStatus = "loading" | "authenticated" | "anonymous";

/** 토큰 읽기 결과 → 세션 상태. 빈 문자열은 토큰이 아니다. */
export function statusFromToken(token: string | null | undefined): AuthStatus {
  return token && token.length > 0 ? "authenticated" : "anonymous";
}

/**
 * 공개 라우트 — **여기 없는 것은 전부 보호 대상이다.**
 *
 * 반대로(보호 목록을 나열하는 식으로) 짜면 화면을 추가하면서 목록에 넣는 것을 잊었을 때
 * 그 화면이 무방비로 열린다. 실수가 안전한 쪽으로 나도록 방향을 뒤집어 둔다.
 */
export const PUBLIC_ROUTES = ["index"] as const;

export function isPublicRoute(routeName: string): boolean {
  return (PUBLIC_ROUTES as readonly string[]).includes(routeName);
}
