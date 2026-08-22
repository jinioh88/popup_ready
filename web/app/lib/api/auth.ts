import { apiRequest, type Schemas, type Unwrapped } from "./client";

/**
 * 인증 엔드포인트 (`POST /auth/signup` · `POST /auth/login`).
 *
 * 요청·응답 타입은 계약 생성 타입을 그대로 쓴다 — 손으로 정의하지 않는다.
 * Refresh 토큰은 Sprint 2 범위라 여기 없다.
 */

export type AuthResult = Unwrapped<Schemas["ApiResponseAuthResponse"]>;

export function login(input: Schemas["LoginRequest"]): Promise<AuthResult> {
  return apiRequest<AuthResult>("/auth/login", { method: "POST", body: input });
}

export function signup(input: Schemas["SignupRequest"]): Promise<AuthResult> {
  return apiRequest<AuthResult>("/auth/signup", { method: "POST", body: input });
}
