import { z } from "zod";

/**
 * 인증 폼 스키마.
 *
 * UI에 종속되지 않게 분리해 둔다 — mobile/ 로그인 연동(Sprint 2)에서 그대로 재사용한다.
 * 필드명은 API 계약(sprint1.md §2.2 `POST /auth/signup` · `/auth/login`)을 따른다.
 */

/** 백엔드 User.role — sprint1.md §2.1 */
export const USER_ROLES = ["BRAND", "LANDLORD", "VENDOR", "ADMIN"] as const;

/** 가입 화면에서 고를 수 있는 역할. ADMIN은 운영자가 직접 부여한다. */
export const SIGNUP_ROLES = ["BRAND", "LANDLORD", "VENDOR"] as const;

export const userRoleSchema = z.enum(USER_ROLES);
export const signupRoleSchema = z.enum(SIGNUP_ROLES);

export type UserRole = z.infer<typeof userRoleSchema>;
export type SignupRole = z.infer<typeof signupRoleSchema>;

export const ROLE_LABELS: Record<UserRole, string> = {
  BRAND: "브랜드 운영자",
  LANDLORD: "건물주",
  VENDOR: "집기 공급사",
  ADMIN: "관리자",
};

const email = z
  .string()
  .trim()
  .min(1, "이메일을 입력해 주세요.")
  .pipe(z.email("이메일 형식이 아닙니다."));

const password = z
  .string()
  .min(8, "비밀번호는 8자 이상이어야 합니다.")
  .max(64, "비밀번호는 64자 이하여야 합니다.");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "비밀번호를 입력해 주세요."),
});

export const signupSchema = z.object({
  email,
  password,
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(50, "이름은 50자 이하여야 합니다."),
  role: signupRoleSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
