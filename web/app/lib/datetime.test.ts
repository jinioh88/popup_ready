import { describe, expect, it } from "vitest";

import { formatSignedAt } from "./datetime";

describe("formatSignedAt", () => {
  it("UTC를 KST로 옮겨 표기한다", () => {
    expect(formatSignedAt("2026-08-22T05:12:31Z")).toBe("2026-08-22 14:12 (KST)");
  });

  it("날짜 경계를 넘는 변환도 맞다", () => {
    expect(formatSignedAt("2026-08-22T16:40:02Z")).toBe("2026-08-23 01:40 (KST)");
  });

  it("미서명(null)은 표기하지 않는다", () => {
    expect(formatSignedAt(null)).toBeUndefined();
    expect(formatSignedAt(undefined)).toBeUndefined();
  });

  it("해석할 수 없는 값은 표기하지 않는다", () => {
    expect(formatSignedAt("어제")).toBeUndefined();
  });

  it("오프셋을 정확히 9시간만 더한다", () => {
    // 소명 자료라 보는 사람 위치에 따라 값이 달라지면 안 된다. 구현이 getUTC*만 쓰므로
    // 실행 환경 타임존과 무관하며, 여기서는 그 오프셋이 정확한지를 고정한다.
    expect(formatSignedAt("2026-01-01T00:00:00Z")).toBe("2026-01-01 09:00 (KST)");
    expect(formatSignedAt("2026-01-01T15:00:00Z")).toBe("2026-01-02 00:00 (KST)");
  });

  it("서머타임이 없는 고정 오프셋이라 여름·겨울이 같다", () => {
    // KST는 DST를 쓰지 않는다 — 계절에 따라 표기가 흔들리면 서명 시각을 신뢰할 수 없다.
    expect(formatSignedAt("2026-07-15T00:00:00Z")).toBe("2026-07-15 09:00 (KST)");
    expect(formatSignedAt("2026-12-15T00:00:00Z")).toBe("2026-12-15 09:00 (KST)");
  });
});
