import { describe, expect, it } from "vitest";

import { cellToPixel, snapToCell } from "./snap";

const CELL = 40;

describe("snapToCell", () => {
  it("셀 정중앙 좌표는 그 셀로 스냅한다", () => {
    expect(snapToCell(80, 120, CELL)).toEqual({ col: 2, row: 3 });
  });

  it("셀 절반 미만이면 이전 셀로 내려붙는다", () => {
    expect(snapToCell(99, 99, CELL)).toEqual({ col: 2, row: 2 });
  });

  it("셀 절반 이상이면 다음 셀로 올려붙는다", () => {
    expect(snapToCell(100, 100, CELL)).toEqual({ col: 3, row: 3 });
  });

  it("원점 근처의 음수 좌표에서 -0을 만들지 않는다", () => {
    const cell = snapToCell(-4, -4, CELL);

    expect(Object.is(cell.col, 0)).toBe(true);
    expect(Object.is(cell.row, 0)).toBe(true);
  });

  it("그리드 밖 음수 좌표는 음수 셀 그대로 돌려준다 — 범위 판정은 collision의 몫이다", () => {
    expect(snapToCell(-80, -40, CELL)).toEqual({ col: -2, row: -1 });
  });
});

describe("cellToPixel", () => {
  it("셀의 좌상단 픽셀 좌표를 돌려준다", () => {
    expect(cellToPixel({ col: 3, row: 2 }, CELL)).toEqual({ x: 120, y: 80 });
  });

  it("스냅 결과를 되돌리면 셀 원점으로 정렬된다", () => {
    expect(cellToPixel(snapToCell(131, 87, CELL), CELL)).toEqual({ x: 120, y: 80 });
  });
});
