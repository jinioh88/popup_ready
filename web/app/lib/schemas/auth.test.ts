import { describe, expect, it } from "vitest";

import type { Schemas } from "../api/client";
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from "./auth";

/**
 * 폼 입력이 계약의 요청 DTO와 어긋나지 않는지 컴파일 타임에 고정한다.
 * 백엔드가 필드명을 바꾸면 타입 재생성 시점에 여기서 먼저 깨진다.
 */
type Assert<T extends true> = T;

export type LoginInputMatchesContract = Assert<
  LoginInput extends Schemas["LoginRequest"] ? true : false
>;
export type SignupInputMatchesContract = Assert<
  SignupInput extends Schemas["SignupRequest"] ? true : false
>;

describe("loginSchema", () => {
  it("이메일 앞뒤 공백은 잘라낸다", () => {
    expect(loginSchema.parse({ email: "  brand@popupready.kr ", password: "pw" }).email).toBe(
      "brand@popupready.kr",
    );
  });

  it("이메일 형식이 아니면 거부한다", () => {
    expect(loginSchema.safeParse({ email: "brand", password: "pw" }).success).toBe(false);
  });

  it("비밀번호가 비면 거부한다 — 길이 규칙은 가입에서만 본다", () => {
    expect(loginSchema.safeParse({ email: "brand@popupready.kr", password: "" }).success).toBe(
      false,
    );
  });
});

describe("signupSchema", () => {
  const valid: SignupInput = {
    email: "brand@popupready.kr",
    password: "popup1234",
    name: "김브랜드",
    role: "BRAND",
  };

  it("계약대로 채운 입력을 통과시킨다", () => {
    expect(signupSchema.parse(valid)).toEqual(valid);
  });

  it("비밀번호가 8자 미만이면 거부한다", () => {
    expect(signupSchema.safeParse({ ...valid, password: "pop123" }).success).toBe(false);
  });

  it("가입 화면에서 ADMIN은 고를 수 없다 — 운영자가 직접 부여한다", () => {
    expect(signupSchema.safeParse({ ...valid, role: "ADMIN" }).success).toBe(false);
  });

  it("이름이 공백뿐이면 거부한다", () => {
    expect(signupSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
  });
});
