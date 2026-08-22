import { describe, expect, it } from "vitest";

import { layoutSchema } from "./layout";

/** sprint1.md §2.3에 실린 예시 그대로. 계약이 바뀌면 이 테스트가 먼저 깨져야 한다. */
const CONTRACT_EXAMPLE = {
  gridCols: 20,
  gridRows: 12,
  cellSizeMm: 500,
  items: [{ fixtureId: 3, col: 4, row: 2, rotation: 90 }],
};

describe("layoutSchema", () => {
  it("스프린트 문서 §2.3 예시를 그대로 통과시킨다", () => {
    expect(layoutSchema.parse(CONTRACT_EXAMPLE)).toEqual(CONTRACT_EXAMPLE);
  });

  it("집기를 하나도 배치하지 않은 레이아웃도 유효하다", () => {
    expect(layoutSchema.safeParse({ ...CONTRACT_EXAMPLE, items: [] }).success).toBe(true);
  });

  it("90의 배수가 아닌 rotation은 거부한다", () => {
    const layout = { ...CONTRACT_EXAMPLE, items: [{ fixtureId: 3, col: 0, row: 0, rotation: 45 }] };

    expect(layoutSchema.safeParse(layout).success).toBe(false);
  });

  it("음수 셀 좌표는 거부한다 — col·row는 좌상단 0-base다", () => {
    const layout = { ...CONTRACT_EXAMPLE, items: [{ fixtureId: 3, col: -1, row: 0, rotation: 0 }] };

    expect(layoutSchema.safeParse(layout).success).toBe(false);
  });

  it("소수 셀 좌표는 거부한다 — 픽셀 좌표가 섞여 들어오는 것을 막는다", () => {
    const layout = {
      ...CONTRACT_EXAMPLE,
      items: [{ fixtureId: 3, col: 4.5, row: 2, rotation: 0 }],
    };

    expect(layoutSchema.safeParse(layout).success).toBe(false);
  });
});
