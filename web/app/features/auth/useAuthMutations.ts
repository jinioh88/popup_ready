import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router";

import { ApiRequestError } from "../../lib/api/client";
import { login, signup, type AuthResult } from "../../lib/api/auth";
import { safeRedirectPath } from "../../lib/api/redirect";
import { setSession } from "../../lib/api/token";
import type { LoginInput, SignupInput } from "../../lib/schemas/auth";

/**
 * 로그인·가입 뮤테이션.
 *
 * 성공하면 accessToken을 보관(localStorage — PM 승인)하고 지도 화면으로 넘긴다.
 * 실패 메시지는 백엔드가 봉투에 실어 준 것을 그대로 쓰되, 코드 없는 예외는 일반 문구로 갈음한다.
 */

function messageOf(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  return "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
}

function useAuthSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  return (result: AuthResult) => {
    setSession(result.accessToken, result.user);

    // 같은 탭에서 계정이 바뀔 수 있다. 이전 사용자의 응답이 캐시에 남아 있으면 새 사용자에게
    // 그대로 보이므로 비운다.
    queryClient.clear();

    // 인증 가드가 실어 보낸 원래 목적지로 되돌린다(검증을 거친 내부 경로만).
    const state = location.state as { from?: unknown } | null;
    void navigate(safeRedirectPath(state?.from), { replace: true });
  };
}

export function useLogin() {
  const onSuccess = useAuthSuccess();

  const mutation = useMutation({
    mutationFn: (values: LoginInput) => login(values),
    onSuccess,
  });

  return {
    submit: (values: LoginInput) => mutation.mutateAsync(values).catch(() => undefined),
    isPending: mutation.isPending,
    errorMessage: mutation.isError ? messageOf(mutation.error) : undefined,
  };
}

export function useSignup() {
  const onSuccess = useAuthSuccess();

  const mutation = useMutation({
    mutationFn: (values: SignupInput) => signup(values),
    onSuccess,
  });

  return {
    submit: (values: SignupInput) => mutation.mutateAsync(values).catch(() => undefined),
    isPending: mutation.isPending,
    errorMessage: mutation.isError ? messageOf(mutation.error) : undefined,
  };
}
