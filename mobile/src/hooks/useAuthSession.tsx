import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { setSessionExpiredHandler } from "../lib/api/authed-client";
import { statusFromToken, type AuthStatus } from "../lib/auth/session";
import {
  clearTokens,
  readAccessToken,
  saveTokens,
  type TokenPair,
} from "../lib/auth/token-storage";

type AuthSessionValue = {
  status: AuthStatus;
  /** 토큰 저장까지 성공해야 인증으로 넘어간다. 저장 실패는 던진다. */
  signIn: (tokens: TokenPair) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

/**
 * 인증 세션 provider — 루트 레이아웃에서 라우터보다 바깥에 둔다.
 *
 * 라우팅을 여기서 하지 않는다. 이 훅은 상태만 들고 있고, 어떤 화면이 존재하는지는
 * `_layout.tsx`의 `Stack.Protected`가 정한다. 그래야 딥링크로 들어온 경로도 같은 판정을 지난다.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    // 언마운트 후 도착하는 결과로 상태를 건드리지 않는다.
    let disposed = false;

    readAccessToken()
      .then((token) => {
        if (!disposed) setStatus(statusFromToken(token));
      })
      .catch(() => {
        // 저장소를 못 읽었으면 "토큰이 있는지 모른다"이지 "있다"가 아니다. 닫는 쪽으로 실패한다.
        if (!disposed) setStatus("anonymous");
      });

    return () => {
      disposed = true;
    };
  }, []);

  const signIn = useCallback(async (tokens: TokenPair) => {
    await saveTokens(tokens);
    setStatus("authenticated");
  }, []);

  const signOut = useCallback(async () => {
    await clearTokens();
    setStatus("anonymous");
  }, []);

  // 재발급까지 실패해 세션이 끝나면 가드가 반응해야 한다. 저장소만 비우면 화면은 인증 상태로
  // 남아 보호 화면을 계속 보여준다.
  useEffect(() => {
    setSessionExpiredHandler(() => setStatus("anonymous"));
    return () => setSessionExpiredHandler(null);
  }, []);

  const value = useMemo<AuthSessionValue>(
    () => ({ status, signIn, signOut }),
    [status, signIn, signOut],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionValue {
  const value = useContext(AuthSessionContext);
  // provider 밖에서 쓰면 조용히 미인증으로 흐르지 않고 여기서 끊는다 — 가드가 빠진 화면이 생긴다.
  if (!value) throw new Error("useAuthSession은 AuthProvider 안에서만 쓸 수 있다.");
  return value;
}
