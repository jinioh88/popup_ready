import { describe, expect, it } from "vitest";

import { DEFAULT_LANDING, safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
  it("앱 내부 경로는 그대로 돌려준다", () => {
    expect(safeRedirectPath("/spaces/1/builder")).toBe("/spaces/1/builder");
  });

  it("프로토콜 상대 URL은 외부로 나갈 수 있어 막는다", () => {
    expect(safeRedirectPath("//evil.example/steal")).toBe(DEFAULT_LANDING);
  });

  it("역슬래시 변형도 막는다 — 브라우저가 //로 해석한다", () => {
    expect(safeRedirectPath("/\\evil.example")).toBe(DEFAULT_LANDING);
  });

  it("절대 URL은 막는다", () => {
    expect(safeRedirectPath("https://evil.example")).toBe(DEFAULT_LANDING);
  });

  it("로그인·가입으로 되돌리면 순환하므로 기본 경로로 보낸다", () => {
    expect(safeRedirectPath("/login")).toBe(DEFAULT_LANDING);
    expect(safeRedirectPath("/signup")).toBe(DEFAULT_LANDING);
  });

  it("문자열이 아니면 기본 경로로 보낸다", () => {
    expect(safeRedirectPath(undefined)).toBe(DEFAULT_LANDING);
    expect(safeRedirectPath({ toString: () => "/spaces" })).toBe(DEFAULT_LANDING);
  });
});
