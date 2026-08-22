import { describe, expect, it } from "vitest";

import { canPlace, isInsideGrid, overlaps } from "./collision";
import type { Placement } from "./types";

const GRID = { gridCols: 20, gridRows: 12 };

const at = (col: number, row: number, cols = 2, rows = 2): Placement => ({ col, row, cols, rows });

describe("isInsideGrid", () => {
  it("그리드 안에 완전히 들어가면 통과", () => {
    expect(isInsideGrid(at(0, 0), GRID)).toBe(true);
  });

  it("오른쪽·아래 끝에 딱 맞게 붙는 배치는 허용한다", () => {
    expect(isInsideGrid(at(18, 10), GRID)).toBe(true);
  });

  it("한 셀이라도 오른쪽 경계를 넘으면 거부", () => {
    expect(isInsideGrid(at(19, 10), GRID)).toBe(false);
  });

  it("한 셀이라도 아래 경계를 넘으면 거부", () => {
    expect(isInsideGrid(at(18, 11), GRID)).toBe(false);
  });

  it("음수 좌표는 거부", () => {
    expect(isInsideGrid(at(-1, 0), GRID)).toBe(false);
  });
});

describe("overlaps", () => {
  it("한 셀이라도 겹치면 true", () => {
    expect(overlaps(at(0, 0), at(1, 1))).toBe(true);
  });

  it("가로로 맞닿기만 하면 겹침이 아니다", () => {
    expect(overlaps(at(0, 0), at(2, 0))).toBe(false);
  });

  it("세로로 맞닿기만 하면 겹침이 아니다", () => {
    expect(overlaps(at(0, 0), at(0, 2))).toBe(false);
  });

  it("모서리만 대각으로 스치는 것도 겹침이 아니다", () => {
    expect(overlaps(at(0, 0), at(2, 2))).toBe(false);
  });
});

describe("canPlace", () => {
  it("빈 그리드에는 배치할 수 있다", () => {
    expect(canPlace(at(0, 0), [], GRID)).toEqual({ ok: true });
  });

  it("범위를 벗어나면 OUT_OF_BOUNDS로 거부한다", () => {
    expect(canPlace(at(19, 0), [], GRID)).toEqual({
      ok: false,
      reason: "OUT_OF_BOUNDS",
      collidingIndexes: [],
    });
  });

  it("겹치면 OVERLAP과 함께 겹친 대상의 인덱스를 돌려준다", () => {
    const existing = [at(0, 0), at(5, 5), at(1, 1)];

    expect(canPlace(at(0, 0), existing, GRID)).toEqual({
      ok: false,
      reason: "OVERLAP",
      collidingIndexes: [0, 2],
    });
  });

  it("범위 밖이면서 겹치기도 하면 범위 판정을 우선한다", () => {
    expect(canPlace(at(19, 0), [at(19, 0)], GRID).ok).toBe(false);
    expect(canPlace(at(19, 0), [at(19, 0)], GRID)).toMatchObject({ reason: "OUT_OF_BOUNDS" });
  });

  it("자기 자신은 ignoreIndex로 제외해야 제자리 회전·이동이 가능하다", () => {
    const existing = [at(3, 3)];

    expect(canPlace(at(3, 3), existing, GRID)).toMatchObject({ reason: "OVERLAP" });
    expect(canPlace(at(3, 3), existing, GRID, 0)).toEqual({ ok: true });
  });
});
