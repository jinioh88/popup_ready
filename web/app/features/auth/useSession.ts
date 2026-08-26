import { useSyncExternalStore } from "react";

import { getAccessToken, subscribeSession } from "../../lib/api/token";

/**
 * 지금 로그인돼 있는가 — **구독해서** 본다.
 *
 * **렌더 시점에 `getAccessToken()`을 한 번 부르면 안 된다**(§8.6). 그러면 뮤테이션 도중
 * 401로 토큰이 비워져도 가드가 다시 판정하지 않아, 사용자는 만료된 채 보호 화면에 남는다.
 * 인수 테스트에서 실제로 그렇게 됐다 — 한 시간이 지나 토큰이 만료됐는데 화면은
 * "인증이 필요합니다"라는 에러 문구만 띄우고 로그인으로 보내지 않았다.
 *
 * `app/lib`이 아니라 여기 있는 이유: `lib`은 React 무의존 계층이다(web/CLAUDE.md).
 * 구독 자체(`subscribeSession`)는 `lib/api/token.ts`에 있고, 이 훅은 그것을 React에 붙일 뿐이다.
 */
export function useAccessToken(): string | null {
  return useSyncExternalStore(subscribeSession, getAccessToken, getServerSnapshot);
}

/**
 * SPA 모드는 빌드 타임에 `/`를 렌더한다 — 그때는 브라우저가 없으므로 **비로그인으로 본다.**
 * 보호 라우트가 빌드 산출물에 로그인 상태로 굳어지면 안 된다.
 */
function getServerSnapshot(): string | null {
  return null;
}
