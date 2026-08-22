import { z } from "zod";

/**
 * 로그인 폼 검증 규칙.
 *
 * 계약(`LoginRequest`)은 email·password가 `minLength: 1`일 뿐이지만, 서버 왕복 전에
 * 거를 수 있는 것은 거른다 — 현장에서 오타 하나로 왕복을 기다리는 비용이 더 크다.
 * 화면 무의존 순수 모듈이라 테스트가 가능하다.
 */
export const loginFormSchema = z.object({
  email: z.string().trim().min(1, "이메일을 입력하라.").email("이메일 형식이 아니다."),
  password: z.string().min(1, "비밀번호를 입력하라."),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
