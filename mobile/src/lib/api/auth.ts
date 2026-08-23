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
  refreshToken: z.string().min(1),
  user: userSummarySchema,
});

/** 재발급 응답. 회전 방식이라 두 토큰이 함께 새로 온다. */
export const tokenPairSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

export type UserSummary = z.infer<typeof userSummarySchema>;
export type AuthResult = z.infer<typeof authResponseSchema>;
export type TokenPair = z.infer<typeof tokenPairSchema>;

/**
 * 생성 타입과 Zod 스키마가 어긋나면 여기서 컴파일 에러가 난다.
 * (`refreshToken` 추가를 실제로 이 검사가 잡았다 — 2026-08-23)
 */
type _AuthCheck = AuthResult extends components["schemas"]["AuthResponse"] ? true : never;
const _authCheck: _AuthCheck = true;
void _authCheck;

type _TokenPairCheck = TokenPair extends components["schemas"]["TokenPairResponse"] ? true : never;
const _tokenPairCheck: _TokenPairCheck = true;
void _tokenPairCheck;

export type LoginInput = components["schemas"]["LoginRequest"];
export type RefreshInput = components["schemas"]["RefreshRequest"];

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

  return parseOrThrow(authResponseSchema, data, "로그인 응답");
}

/**
 * 토큰 재발급(POST /auth/refresh). 회전 방식이라 이전 refresh 토큰은 무효가 된다.
 *
 * 실패는 `REFRESH_TOKEN_INVALID`(401)로 온다 — 상태 코드가 아니라 이 코드로 분기한다.
 */
export async function refreshTokens(
  baseUrl: string,
  input: RefreshInput,
  options?: Pick<ApiRequestOptions, "fetchImpl">,
): Promise<TokenPair> {
  const data = await apiRequest(baseUrl, "/auth/refresh", {
    method: "POST",
    body: input,
    fetchImpl: options?.fetchImpl,
  });

  return parseOrThrow(tokenPairSchema, data, "재발급 응답");
}

/**
 * 계약 위반을 조용히 넘기지 않는다.
 *
 * 생성 타입만으로는 응답을 믿을 수 없고(springdoc이 채우지 않는 부분이 있다), 토큰이 없는데
 * 성공으로 처리하면 이후 모든 요청이 조용히 401로 죽는다 — 경계에서 끊는 편이 싸다.
 */
function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const parsed = schema.safeParse(data);
  if (parsed.success) return parsed.data;

  throw new ApiRequestError(
    "INTERNAL_ERROR",
    `${label}이 계약과 다르다: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    null,
  );
}
