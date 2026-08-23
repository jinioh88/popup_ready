import { useMutation } from "@tanstack/react-query";
import Constants from "expo-constants";

import { resolveApiBaseUrl } from "../lib/api/config";
import { ApiRequestError } from "../lib/api/client";
import { login, type AuthResult, type LoginInput } from "../lib/api/auth";
import { useAuthSession } from "./useAuthSession";

const NO_BASE_URL_MESSAGE = "API 주소를 확인할 수 없다. EXPO_PUBLIC_API_URL을 지정하라.";

/**
 * 로그인(§5-2) — POST /auth/login → 토큰 저장 → 세션 인증 전이.
 *
 * 서버 상태이므로 TanStack Query의 mutation으로 다룬다. 토큰 저장까지 성공해야 성공이다.
 * 저장을 세션(`signIn`)에 맡겨 **저장 경로가 하나만 남게** 한다 — 두 곳에서 저장하면
 * 화면이 보는 상태와 저장소가 어긋날 수 있다.
 */
export function useLogin() {
  const baseUrl = resolveApiBaseUrl(Constants.expoConfig?.hostUri, process.env.EXPO_PUBLIC_API_URL);
  const { signIn } = useAuthSession();

  const mutation = useMutation<AuthResult, Error, LoginInput>({
    mutationFn: async (input) => {
      if (!baseUrl) throw new ApiRequestError("INTERNAL_ERROR", NO_BASE_URL_MESSAGE, null);

      const result = await login(baseUrl, input);
      // 저장 실패를 삼키면 다음 화면에서 토큰 없이 요청이 나간다. 로그인 실패로 취급한다.
      await signIn({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      return result;
    },
  });

  return { ...mutation, baseUrl };
}

/** 화면에 그대로 띄울 수 있는 문구로 바꾼다. 분기는 code로 한다. */
export function loginErrorMessage(error: unknown): string {
  if (!(error instanceof ApiRequestError)) {
    return error instanceof Error ? error.message : "로그인에 실패했다.";
  }
  switch (error.code) {
    case "INVALID_CREDENTIALS":
      return "이메일 또는 비밀번호가 올바르지 않다.";
    case "VALIDATION_FAILED":
      return error.message;
    case "UNAUTHORIZED":
      return "인증에 실패했다. 다시 로그인하라.";
    default:
      return `로그인에 실패했다: ${error.message}`;
  }
}
