import { z } from "zod";

import { apiRequest, ApiRequestError, type ApiRequestOptions } from "./client";
import type { components } from "./schema";

/**
 * 생성 타입은 모든 필드가 optional이다 — springdoc이 required를 싣지 않기 때문이다.
 * 즉 `accessToken`이 없어도 tsc는 통과한다. 토큰 없이 로그인 성공으로 처리하면
 * 이후 모든 요청이 조용히 401로 죽으므로, 경계에서 Zod로 굳힌다.
 */
export const userSummarySchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  role: z.enum(["BRAND", "LANDLORD", "VENDOR", "ADMIN"]),
});

export const authResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: userSummarySchema,
});

export type UserSummary = z.infer<typeof userSummarySchema>;
export type AuthResult = z.infer<typeof authResponseSchema>;

/** 생성 타입과 Zod 스키마가 어긋나면 여기서 컴파일 에러가 난다. */
type _ContractCheck = AuthResult extends components["schemas"]["AuthResponse"] ? true : never;
const _contractCheck: _ContractCheck = true;
void _contractCheck;

export type LoginInput = components["schemas"]["LoginRequest"];

/** 로그인(POST /auth/login). 성공 200, 실패는 봉투 error로 온다(지시서 §2.2). */
export async function login(
  baseUrl: string,
  input: LoginInput,
  options?: Pick<ApiRequestOptions, "fetchImpl">,
): Promise<AuthResult> {
  const data = await apiRequest(baseUrl, "/auth/login", {
    method: "POST",
    body: input,
    fetchImpl: options?.fetchImpl,
  });

  const parsed = authResponseSchema.safeParse(data);
  if (!parsed.success) {
    // 계약 위반이다. 조용히 넘기면 토큰 없는 로그인 성공이 되어 더 비싸진다.
    throw new ApiRequestError(
      "INTERNAL_ERROR",
      `로그인 응답이 계약과 다르다: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
      null,
    );
  }
  return parsed.data;
}
