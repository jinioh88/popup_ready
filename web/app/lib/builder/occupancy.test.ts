import { describe, expect, it } from "vitest";

import { occupiedCellCount, occupiedSize, placementCells, toPlacement } from "./occupancy";

const CELL_SIZE_MM = 500;

/** 딱 떨어지는 규격: 1000×500mm → 2×1 셀 */
const HANGER = { widthMm: 1000, depthMm: 500 };
/** 나누어떨어지지 않는 규격: 1200×600mm → ceil(2.4)×ceil(1.2) = 3×2 셀 */
const SHOWCASE = { widthMm: 1200, depthMm: 600 };

describe("occupiedSize", () => {
  it("mm 규격을 셀 수로 올림한다", () => {
    expect(occupiedSize(HANGER, CELL_SIZE_MM, 0)).toEqual({ cols: 2, rows: 1 });
  });

  it("나누어떨어지지 않는 규격은 올림해 한 셀을 더 차지한다", () => {
    expect(occupiedSize(SHOWCASE, CELL_SIZE_MM, 0)).toEqual({ cols: 3, rows: 2 });
  });

  it("180도 회전은 점유 크기를 바꾸지 않는다", () => {
    expect(occupiedSize(SHOWCASE, CELL_SIZE_MM, 180)).toEqual({ cols: 3, rows: 2 });
  });

  it("90도 회전은 폭·깊이를 스왑한다", () => {
    expect(occupiedSize(SHOWCASE, CELL_SIZE_MM, 90)).toEqual({ cols: 2, rows: 3 });
  });

  it("270도 회전도 폭·깊이를 스왑한다", () => {
    expect(occupiedSize(SHOWCASE, CELL_SIZE_MM, 270)).toEqual({ cols: 2, rows: 3 });
  });

  it("셀보다 작은 집기도 최소 1×1 셀을 차지한다", () => {
    expect(occupiedSize({ widthMm: 300, depthMm: 200 }, CELL_SIZE_MM, 0)).toEqual({
      cols: 1,
      rows: 1,
    });
  });
});

describe("occupiedCellCount", () => {
  it("점유 셀 수는 ceil(width/cell) × ceil(depth/cell)이다", () => {
    expect(occupiedCellCount(SHOWCASE, CELL_SIZE_MM, 0)).toBe(6);
  });

  it("회전해도 점유 셀 수는 같다", () => {
    expect(occupiedCellCount(SHOWCASE, CELL_SIZE_MM, 90)).toBe(6);
  });
});

describe("toPlacement", () => {
  it("배치 원점과 회전이 반영된 점유 사각형을 만든다", () => {
    expect(toPlacement({ col: 4, row: 2 }, SHOWCASE, CELL_SIZE_MM, 90)).toEqual({
      col: 4,
      row: 2,
      cols: 2,
      rows: 3,
    });
  });
});

describe("placementCells", () => {
  it("점유 사각형이 덮는 셀을 모두 열거한다", () => {
    expect(placementCells({ col: 1, row: 1, cols: 2, rows: 2 })).toEqual([
      { col: 1, row: 1 },
      { col: 2, row: 1 },
      { col: 1, row: 2 },
      { col: 2, row: 2 },
    ]);
  });
});
