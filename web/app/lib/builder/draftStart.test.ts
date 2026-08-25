import { describe, expect, it } from "vitest";

import { findDraftStartCell } from "./draftStart";
import { toPlacement } from "./occupancy";
import type { FixtureLookup, Placement } from "./types";
import type { GridSpec } from "../schemas/layout";

/**
 * **빈 캔버스만 보는 테스트는 이 결함을 못 잡는다** — 빈 캔버스에서는 `(0,0)`이 정답이라
 * 무조건 `(0,0)`을 돌려주던 옛 구현도 통과한다. 그래서 아래는 전부 **무언가 놓여 있는 상태**다.
 */

const GRID: GridSpec = { gridCols: 4, gridRows: 3, cellSizeMm: 500 };

/** 1×1칸짜리 집기. 칸 계산을 단순하게 두고 자리 탐색만 본다. */
const FIXTURES: FixtureLookup = {
  1: { id: 1, widthMm: 500, depthMm: 500, powerWatt: 0, dailyRentalFee: 0 },
};

/** 주어진 칸들을 1×1 집기로 채운 배치 목록. */
function occupy(cells: Array<[number, number]>): Placement[] {
  return cells.map(([col, row]) =>
    toPlacement({ col, row }, FIXTURES[1]!, GRID.cellSizeMm, 0),
  );
}

function start(existing: Placement[], from?: { col: number; row: number }) {
  return findDraftStartCell({ fixtureId: 1, fixtures: FIXTURES, grid: GRID, existing, from });
}

describe("findDraftStartCell — 빈 칸에서 시작한다", () => {
  it("빈 캔버스에서는 (0,0)이다", () => {
    expect(start([])).toEqual({ col: 0, row: 0 });
  });

  it("(0,0)이 점유돼 있으면 다음 빈 칸으로 간다", () => {
    /*
     * 이것이 결함의 얼굴이다. 옛 구현은 여기서도 (0,0)을 돌려줬고, 그래서 초안이 화면 구석에
     * **빨간 무효 블록**으로 떴다 — 사용자가 보고 있던 곳도 아니고, 빨간색이라 "놓으려는 것"이
     * 아니라 "오류"로 읽혔다.
     */
    expect(start(occupy([[0, 0]]))).toEqual({ col: 1, row: 0 });
  });

  it("앞줄이 다 차 있으면 다음 줄로 넘어간다", () => {
    const filled = occupy([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ]);

    expect(start(filled)).toEqual({ col: 0, row: 1 });
  });
});

describe("findDraftStartCell — 선택된 집기 다음부터 찾는다", () => {
  it("선택 바로 다음 칸이 비었으면 거기서 시작한다", () => {
    // `placeItem`이 배치 직후 선택을 남기므로 연속 배치가 기본 경로다.
    // 방금 놓은 집기 옆이 다음 자리일 확률이 높고, 사용자 시선도 이미 거기 있다.
    expect(start(occupy([[1, 1]]), { col: 1, row: 1 })).toEqual({ col: 2, row: 1 });
  });

  it("선택이 마지막 칸이면 한 바퀴 돌아 앞쪽 빈자리를 찾는다", () => {
    // 오른쪽 끝에서 선택했다고 초안을 못 만들면 안 된다.
    const filled = occupy([[3, 2]]);

    expect(start(filled, { col: 3, row: 2 })).toEqual({ col: 0, row: 0 });
  });

  it("선택 다음이 막혀 있으면 그 너머를 본다", () => {
    const filled = occupy([
      [0, 0],
      [1, 0],
    ]);

    expect(start(filled, { col: 0, row: 0 })).toEqual({ col: 2, row: 0 });
  });
});

describe("findDraftStartCell — 놓을 자리가 정말 없을 때", () => {
  it("캔버스가 꽉 차면 (0,0)으로 떨어진다 — 그때 빨간 것은 참말이다", () => {
    /*
     * **빨강을 없애는 수정이 아니다.** 지금 빨강이 나쁜 이유는 빨개서가 아니라 거짓말이어서다 —
     * "시작 위치를 잘못 골랐다"를 "놓을 데가 없다"로 보여주고 있었다.
     * 정말 놓을 데가 없으면 빨간 것이 맞고, 그건 그대로 둔다.
     */
    const everyCell: Array<[number, number]> = [];
    for (let row = 0; row < GRID.gridRows; row += 1) {
      for (let col = 0; col < GRID.gridCols; col += 1) {
        everyCell.push([col, row]);
      }
    }

    expect(start(occupy(everyCell))).toEqual({ col: 0, row: 0 });
  });

  it("규격을 모르는 집기는 판정 자체가 불가능하다 — (0,0)", () => {
    expect(
      findDraftStartCell({ fixtureId: 999, fixtures: FIXTURES, grid: GRID, existing: [] }),
    ).toEqual({ col: 0, row: 0 });
  });

  it("그리드가 아직 없으면 (0,0)", () => {
    // 도면을 불러오기 전 상태. 훑을 칸이 0개다.
    expect(
      findDraftStartCell({
        fixtureId: 1,
        fixtures: FIXTURES,
        grid: { gridCols: 0, gridRows: 0, cellSizeMm: 0 },
        existing: [],
      }),
    ).toEqual({ col: 0, row: 0 });
  });
});
