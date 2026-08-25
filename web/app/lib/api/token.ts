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
const CURRENT_USER_KEY = "popupready.currentUser";

/**
 * 로그인한 사람이 누구인가. 로그인 응답의 `user`를 그대로 보관한다.
 *
 * **화면 표시 판단에만 쓴다** — "이 사람에게 결제 버튼을 보여줄까" 같은 것. **접근 통제가 아니다.**
 * localStorage 값이므로 사용자가 고칠 수 있고, 고쳐 봤자 서버가 403으로 막는다(§8.10).
 *
 * **토큰과 같은 모듈에 두는 이유**: 둘은 반드시 함께 생기고 함께 사라져야 한다. 따로 두면
 * 로그아웃이 한쪽만 지우는 순간 "토큰은 없는데 이전 사용자로 보이는" 상태가 만들어진다.
 */
export type CurrentUser = {
  id: number;
  email: string;
  name: string;
  role: string;
};

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

/**
 * 로그인한 사람. 없거나 깨져 있으면 `null`이다.
 *
 * **`null`을 "권한 없음"이 아니라 "모른다"로 다뤄야 한다** — 저장 전 세션·프라이빗 모드·
 * 값 손상이 전부 여기로 떨어진다. 모르는 상태에서 단정적인 안내를 띄우면 그게 거짓말이 된다.
 */
export function getCurrentUser(): CurrentUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CURRENT_USER_KEY);
    return raw ? (JSON.parse(raw) as CurrentUser) : null;
  } catch {
    // 저장소 차단, 또는 남아 있던 값이 JSON이 아닌 경우. 둘 다 "모른다"로 취급한다.
    return null;
  }
}

/**
 * 세션이 바뀌었을 때 알림을 받을 대상들.
 *
 * **가드가 렌더 시점에 한 번만 판정하던 것이 이 구독이 생긴 이유다**(§8.6). 401을 받아
 * 토큰을 비워도 레이아웃은 리렌더되지 않았고, 그래서 **로그인으로 보내지지 않은 채**
 * 화면에 에러 문구만 뜬 상태로 남았다. 이후 모든 요청이 401로 되풀이되는데
 * **사용자는 자기가 로그아웃됐다는 것을 몰랐다** — 정확히 조용한 실패다.
 */
const listeners = new Set<() => void>();

function emitSessionChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * 세션 변화를 구독한다. `useSyncExternalStore`가 쓰는 형태다.
 *
 * `storage` 이벤트도 함께 듣는다 — **다른 탭에서 로그아웃**하면 이 탭도 따라야 한다.
 * (같은 탭의 변경에는 `storage`가 오지 않으므로 위 `listeners`가 필요하다. 둘 다 있어야 한다.)
 */
export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);

  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }

  return () => {
    listeners.delete(listener);

    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}

/** 로그인 성공. **토큰과 사용자를 함께 심는다** — 한쪽만 있는 상태를 만들지 않는다. */
export function setSession(token: string, user: CurrentUser): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    window.localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } catch {
    // 저장에 실패해도 현재 세션은 메모리상 응답으로 계속 진행할 수 있다.
  }

  emitSessionChange();
}

/** 로그아웃·401. **둘을 함께 지운다** — 토큰만 지우면 이전 사용자가 화면에 남는다. */
export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(CURRENT_USER_KEY);
  } catch {
    // 삭제 실패는 무시한다 — 이후 요청이 401로 걸러진다.
  }

  // **저장소 삭제가 실패해도 알린다.** 실패를 삼키고 조용히 있으면 가드가 다시 판정할 기회를
  // 잃는다 — 이 알림이 없어서 생긴 결함을 고치는 중이다.
  emitSessionChange();
}
