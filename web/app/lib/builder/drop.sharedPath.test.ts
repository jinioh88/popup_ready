import { describe, expect, it } from "vitest";

import { resolveDrop, resolveDropAtCell } from "./drop";
import type { FixtureLookup, Placement } from "./types";
import type { GridSpec } from "../schemas/layout";

/**
 * **두 입력 경로가 같은 판정을 쓴다는 것을 못 박는 테스트** (sprint2-web.md I-1).
 *
 * 마우스는 픽셀, 키보드는 셀 좌표로 들어오지만 판정은 한 곳이어야 한다. 키보드 경로가 자체
 * 판정을 갖게 되면 마우스로는 되는 자리가 키보드로는 거부되기 시작하고, 그 어긋남은 조작을
 * 바꿔가며 같은 자리를 눌러보기 전에는 드러나지 않는다.
 */

/** 렌더 계층의 셀 크기(px). 픽셀 경로를 태우기 위한 값일 뿐 판정에는 영향이 없다. */
const CELL_PX = 32;

const GRID: GridSpec = { gridCols: 10, gridRows: 10, cellSizeMm: 500 };

const FIXTURES: FixtureLookup = {
  1: { id: 1, widthMm: 1000, depthMm: 500, powerWatt: 100, dailyRentalFee: 0 },
  2: { id: 2, widthMm: 500, depthMm: 500, powerWatt: 0, dailyRentalFee: 0 },
};

const OCCUPIED: Placement[] = [{ col: 3, row: 3, cols: 2, rows: 1 }];

/** 같은 자리를 픽셀로 찍은 것과 셀로 찍은 것. */
function bothPaths(col: number, row: number, existing: readonly Placement[] = []) {
  const common = { fixtureId: 1, fixtures: FIXTURES, grid: GRID, existing };

  return {
    mouse: resolveDrop({ ...common, x: col * CELL_PX, y: row * CELL_PX, cellPx: CELL_PX }),
    keyboard: resolveDropAtCell({ ...common, cell: { col, row } }),
  };
}

describe("두 입력 경로의 판정 일치", () => {
  it("빈 자리 — 결과가 완전히 같다", () => {
    const { mouse, keyboard } = bothPaths(2, 2);

    expect(mouse).toEqual(keyboard);
  });

  it("겹치는 자리 — 둘 다 valid: false이고 자리도 같다", () => {
    const { mouse, keyboard } = bothPaths(3, 3, OCCUPIED);

    expect(mouse).toEqual(keyboard);
    expect(keyboard).toMatchObject({ ok: true, valid: false });
  });

  it("범위를 벗어난 자리 — 둘 다 자리는 계산하고 valid: false다", () => {
    // 2칸짜리 집기를 마지막 열에 놓으면 오른쪽으로 삐져나간다.
    const { mouse, keyboard } = bothPaths(9, 0);

    expect(mouse).toEqual(keyboard);
    expect(keyboard).toMatchObject({ ok: true, valid: false });
  });

  it("모르는 집기 — 둘 다 판정 불가로 떨어진다", () => {
    const common = { fixtureId: 999, fixtures: FIXTURES, grid: GRID, existing: [] };

    expect(resolveDrop({ ...common, x: 0, y: 0, cellPx: CELL_PX })).toEqual(
      resolveDropAtCell({ ...common, cell: { col: 0, row: 0 } }),
    );
  });

  it("그리드 전 좌표에서 두 경로가 한 칸도 어긋나지 않는다", () => {
    // 한 자리만 갈라져도 "마우스로는 되는데 키보드로는 안 되는" 자리가 생긴다.
    for (let row = 0; row < GRID.gridRows; row += 1) {
      for (let col = 0; col < GRID.gridCols; col += 1) {
        const { mouse, keyboard } = bothPaths(col, row, OCCUPIED);

        expect(mouse).toEqual(keyboard);
      }
    }
  });
});

describe("회전은 두 경로에서 같은 점유 크기를 낳는다", () => {
  it("90도면 폭·깊이가 스왑된다", () => {
    const common = { fixtureId: 1, fixtures: FIXTURES, grid: GRID, existing: [] };

    const upright = resolveDropAtCell({ ...common, cell: { col: 0, row: 0 }, rotation: 0 });
    const rotated = resolveDropAtCell({ ...common, cell: { col: 0, row: 0 }, rotation: 90 });

    expect(upright).toMatchObject({ ok: true, placement: { cols: 2, rows: 1 } });
    expect(rotated).toMatchObject({ ok: true, placement: { cols: 1, rows: 2 } });
  });

  it("회전을 주지 않으면 0도다 — 픽셀 경로의 기존 동작이 그대로다", () => {
    const common = { fixtureId: 1, fixtures: FIXTURES, grid: GRID, existing: [] };

    expect(resolveDrop({ ...common, x: 0, y: 0, cellPx: CELL_PX })).toEqual(
      resolveDropAtCell({ ...common, cell: { col: 0, row: 0 }, rotation: 0 }),
    );
  });
});

describe("자기 자신과의 겹침 제외", () => {
  it("옮기는 중인 집기는 자기 자리와 겹쳐도 유효하다", () => {
    // 이게 없으면 한 칸 옮기기가 항상 자기 자신과의 겹침으로 거부된다.
    const common = { fixtureId: 1, fixtures: FIXTURES, grid: GRID, existing: OCCUPIED };

    expect(resolveDropAtCell({ ...common, cell: { col: 3, row: 3 } })).toMatchObject({
      valid: false,
    });
    expect(
      resolveDropAtCell({ ...common, cell: { col: 3, row: 3 }, ignoreIndex: 0 }),
    ).toMatchObject({ valid: true });
  });
});
