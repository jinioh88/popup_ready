import { loginFormSchema } from "../src/lib/api/login-form";

describe("loginFormSchema", () => {
  it("정상 입력을 통과시키고 이메일 공백을 다듬는다", () => {
    const r = loginFormSchema.safeParse({ email: "  brand@popupready.com  ", password: "pw" });
    expect(r.success).toBe(true);
    expect(r.success && r.data.email).toBe("brand@popupready.com");
  });

  it("빈 입력을 거른다", () => {
    const r = loginFormSchema.safeParse({ email: "", password: "" });
    expect(r.success).toBe(false);
  });

  // 서버 왕복 전에 거를 수 있는 것은 거른다 — 현장에서 왕복 대기가 더 비싸다.
  it("이메일 형식이 아니면 거른다", () => {
    const r = loginFormSchema.safeParse({ email: "brand", password: "pw" });
    expect(r.success).toBe(false);
  });

  it("비밀번호만 비어도 거른다", () => {
    const r = loginFormSchema.safeParse({ email: "brand@popupready.com", password: "" });
    expect(r.success).toBe(false);
  });
});
