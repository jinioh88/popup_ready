import { describe, expect, it } from "vitest";

import { isRotateKey } from "./rotateKey";

/**
 * 이 판정이 두 훅의 공유물이라, 여기서 깨지면 초안 회전과 배치 회전이 함께 깨진다.
 */
describe("isRotateKey — 입력기와 무관해야 한다", () => {
  it("한글 입력 상태에서도 회전 키로 읽는다", () => {
    // 인수 테스트에서 실제로 걸린 경로. 사용자는 R을 눌렀는데 key로는 'ㄱ'이 온다.
    expect(isRotateKey({ key: "ㄱ", code: "KeyR" })).toBe(true);
  });

  it("영문 입력 상태에서 동작한다 (대소문자 모두)", () => {
    expect(isRotateKey({ key: "r", code: "KeyR" })).toBe(true);
    expect(isRotateKey({ key: "R", code: "KeyR" })).toBe(true);
  });

  it("code가 없어도 key로 잡는다 — 두 분기는 서로를 대체하지 않는다", () => {
    // Dvorak에서 R 라벨 키의 code는 KeyP다. code만 보면 그쪽 사용자가 못 쓴다.
    expect(isRotateKey({ key: "r", code: "KeyP" })).toBe(true);
    expect(isRotateKey({ key: "R", code: "" })).toBe(true);
  });

  it("다른 키는 회전이 아니다", () => {
    expect(isRotateKey({ key: "ㄴ", code: "KeyS" })).toBe(false);
    expect(isRotateKey({ key: "ArrowLeft", code: "ArrowLeft" })).toBe(false);
    expect(isRotateKey({ key: "Enter", code: "Enter" })).toBe(false);
  });
});
