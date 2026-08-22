import { describe, expect, it } from "vitest";

import { resolveDrop } from "./drop";
import type { FixtureLookup, Placement } from "./types";

const GRID = { gridCols: 20, gridRows: 12, cellSizeMm: 500 };
const CELL_PX = 32;

/** 1200×600mm → 3×2 셀 */
const SHOWCASE = { id: 1, widthMm: 1200, depthMm: 600, powerWatt: 60, dailyRentalFee: 38_000 };
const FIXTURES: FixtureLookup = { [SHOWCASE.id]: SHOWCASE };

const at = (x: number, y: number, existing: readonly Placement[] = [], fixtureId = SHOWCASE.id) =>
  resolveDrop({ fixtureId, fixtures: FIXTURES, x, y, cellPx: CELL_PX, grid: GRID, existing });

describe("resolveDrop", () => {
  it("빈 자리에 놓으면 스냅된 위치와 함께 유효로 판정한다", () => {
    expect(at(CELL_PX * 4, CELL_PX * 2)).toEqual({
      ok: true,
      placement: { col: 4, row: 2, cols: 3, rows: 2 },
      valid: true,
    });
  });

  it("겹치는 자리도 위치는 계산한다 — 빨간 하이라이트를 그려야 하기 때문", () => {
    const result = at(CELL_PX * 4, CELL_PX * 2, [{ col: 5, row: 2, cols: 2, rows: 2 }]);

    expect(result).toMatchObject({ ok: true, valid: false });
  });

  it("그리드를 벗어나는 자리도 위치는 계산하고 유효하지 않다고만 표시한다", () => {
    expect(at(CELL_PX * 19, 0)).toMatchObject({ ok: true, valid: false });
  });

  it("집기 규격을 못 찾으면 판정 자체가 불가능하므로 UNKNOWN_FIXTURE로 거부한다", () => {
    // 카탈로그가 아직 안 왔거나 목록에서 사라진 집기를 끌어다 놓은 경우.
    // 여기서 조용히 넘기면 사용자는 아무 일도 일어나지 않은 것으로 본다.
    expect(at(0, 0, [], 999)).toEqual({ ok: false, reason: "UNKNOWN_FIXTURE" });
  });
});
