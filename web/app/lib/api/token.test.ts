import { describe, expect, it } from "vitest";

import { getAccessToken } from "./token";

/**
 * 이 테스트는 브라우저가 없는 환경(node)에서 돈다 — SPA 모드가 빌드 타임에 `/`를 렌더할 때와
 * 같은 조건이다. 그 구간에서 localStorage에 손대면 빌드가 깨진다.
 */
describe("getAccessToken", () => {
  it("window가 없는 환경에서는 throw하지 않고 비로그인으로 취급한다", () => {
    expect(() => getAccessToken()).not.toThrow();
    expect(getAccessToken()).toBeNull();
  });
});
