import { beforeEach, describe, expect, it } from "vitest";

import type { FixtureLookup } from "../lib/builder/types";
import { nextRotation, useBuilderStore } from "./builder";

const SPACE_ID = 1;
const GRID = { gridCols: 10, gridRows: 6, cellSizeMm: 500 };

/** 1000×500mm → 2×1 셀 */
const HANGER = { id: 1, widthMm: 1000, depthMm: 500, powerWatt: 0, dailyRentalFee: 20_000 };
/** 1200×600mm → 3×2 셀 */
const SHOWCASE = { id: 2, widthMm: 1200, depthMm: 600, powerWatt: 60, dailyRentalFee: 35_000 };

const FIXTURES: FixtureLookup = { [HANGER.id]: HANGER, [SHOWCASE.id]: SHOWCASE };

const store = () => useBuilderStore.getState();

const place = (fixtureId: number, col: number, row: number, rotation: 0 | 90 | 180 | 270 = 0) =>
  store().placeItem({ fixtureId, col, row, rotation }, FIXTURES);

beforeEach(() => {
  store().reset();
  store().initGrid(SPACE_ID, GRID);
});

describe("nextRotation", () => {
  it("90도씩 시계 방향으로 돈다", () => {
    expect(nextRotation(0)).toBe(90);
    expect(nextRotation(90)).toBe(180);
    expect(nextRotation(180)).toBe(270);
  });

  it("270도에서 0으로 되돌아온다", () => {
    expect(nextRotation(270)).toBe(0);
  });
});

describe("initGrid", () => {
  it("그리드를 갈아끼우면 기존 배치를 비운다", () => {
    place(HANGER.id, 0, 0);
    store().initGrid(SPACE_ID, { gridCols: 4, gridRows: 4, cellSizeMm: 500 });

    expect(store().items).toEqual([]);
    expect(store().selectedIndex).toBeNull();
  });

  it("같은 상가·같은 그리드로 다시 호출해도 배치가 유지된다 — 리렌더로 작업이 날아가면 안 된다", () => {
    place(HANGER.id, 0, 0);
    store().initGrid(SPACE_ID, { ...GRID });

    expect(store().items).toHaveLength(1);
    expect(store().selectedIndex).toBe(0);
  });

  it("상가가 바뀌면 그리드 규격이 같아도 배치를 비운다 — 남은 집기가 다른 상가로 제출되면 안 된다", () => {
    place(HANGER.id, 0, 0);
    store().initGrid(SPACE_ID + 1, { ...GRID });

    expect(store().items).toEqual([]);
    expect(store().selectedIndex).toBeNull();
  });
});

describe("placeItem", () => {
  it("빈 자리에 놓으면 셀 좌표 그대로 보관하고 선택 상태로 만든다", () => {
    expect(place(HANGER.id, 2, 1)).toEqual({ ok: true });
    expect(store().items).toEqual([{ fixtureId: HANGER.id, col: 2, row: 1, rotation: 0 }]);
    expect(store().selectedIndex).toBe(0);
  });

  it("그리드 밖으로 나가면 거부하고 상태를 바꾸지 않는다", () => {
    expect(place(HANGER.id, 9, 0)).toMatchObject({ reason: "OUT_OF_BOUNDS" });
    expect(store().items).toEqual([]);
  });

  it("이미 놓인 집기와 겹치면 거부한다", () => {
    place(HANGER.id, 0, 0);

    expect(place(SHOWCASE.id, 1, 0)).toMatchObject({ reason: "OVERLAP", collidingIndexes: [0] });
    expect(store().items).toHaveLength(1);
  });

  it("맞닿기만 하는 자리에는 놓을 수 있다", () => {
    place(HANGER.id, 0, 0);

    expect(place(HANGER.id, 2, 0)).toEqual({ ok: true });
    expect(store().items).toHaveLength(2);
  });

  it("회전 상태로 놓으면 스왑된 점유 크기로 판정한다", () => {
    // 3×2 쇼케이스를 90도 돌리면 2×3 — row 4에서 세로로 6행을 넘지 않는다
    expect(place(SHOWCASE.id, 0, 3, 90)).toEqual({ ok: true });
    expect(place(SHOWCASE.id, 5, 5, 90)).toMatchObject({ reason: "OUT_OF_BOUNDS" });
  });

  it("카탈로그에 없는 집기는 UNKNOWN_FIXTURE로 거부한다", () => {
    expect(store().placeItem({ fixtureId: 999, col: 0, row: 0, rotation: 0 }, FIXTURES)).toEqual({
      ok: false,
      reason: "UNKNOWN_FIXTURE",
      collidingIndexes: [],
    });
    expect(store().items).toEqual([]);
  });

  it("이미 놓인 집기의 규격을 못 찾으면 판정을 통과시키지 않는다", () => {
    place(HANGER.id, 0, 0);

    // 카탈로그가 덜 채워진 상태. 기존 배치를 빼고 판정하면 겹치는 자리를 빈 자리로 오인한다.
    const partial = { [SHOWCASE.id]: SHOWCASE };

    expect(
      store().placeItem({ fixtureId: SHOWCASE.id, col: 0, row: 0, rotation: 0 }, partial),
    ).toMatchObject({ reason: "UNKNOWN_FIXTURE" });
    expect(store().items).toHaveLength(1);
  });
});

describe("moveItem", () => {
  it("빈 자리로 옮기면 좌표만 갱신한다", () => {
    place(HANGER.id, 0, 0);

    expect(store().moveItem(0, 4, 2, FIXTURES)).toEqual({ ok: true });
    expect(store().items[0]).toMatchObject({ col: 4, row: 2 });
  });

  it("제자리 이동은 자기 자신과의 겹침으로 거부되지 않는다", () => {
    place(HANGER.id, 3, 3);

    expect(store().moveItem(0, 3, 3, FIXTURES)).toEqual({ ok: true });
  });

  it("다른 집기와 겹치는 자리로는 옮기지 못하고 원래 좌표를 유지한다", () => {
    place(HANGER.id, 0, 0);
    place(HANGER.id, 5, 0);

    expect(store().moveItem(1, 1, 0, FIXTURES)).toMatchObject({ reason: "OVERLAP" });
    expect(store().items[1]).toMatchObject({ col: 5, row: 0 });
  });
});

describe("rotateItem", () => {
  it("회전이 가능하면 rotation만 갱신한다", () => {
    place(SHOWCASE.id, 0, 0);

    expect(store().rotateItem(0, FIXTURES)).toEqual({ ok: true });
    expect(store().items[0]).toMatchObject({ col: 0, row: 0, rotation: 90 });
  });

  it("회전 결과가 그리드를 넘으면 거부하고 rotation을 되돌린다", () => {
    // 3×2 쇼케이스를 row 4에 두면 90도 회전 시 2×3이 되어 6행을 넘는다
    place(SHOWCASE.id, 0, 4);

    expect(store().rotateItem(0, FIXTURES)).toMatchObject({ reason: "OUT_OF_BOUNDS" });
    expect(store().items[0].rotation).toBe(0);
  });

  it("회전 결과가 옆 집기와 겹치면 거부한다", () => {
    place(SHOWCASE.id, 0, 0);
    place(HANGER.id, 0, 2);

    expect(store().rotateItem(0, FIXTURES)).toMatchObject({ reason: "OVERLAP" });
    expect(store().items[0].rotation).toBe(0);
  });
});

describe("removeItem", () => {
  it("삭제하면 목록에서 빠진다", () => {
    place(HANGER.id, 0, 0);
    place(HANGER.id, 5, 0);
    store().removeItem(0);

    expect(store().items).toHaveLength(1);
    expect(store().items[0]).toMatchObject({ col: 5 });
  });

  it("선택 중이던 집기를 지우면 선택이 해제된다", () => {
    place(HANGER.id, 0, 0);
    store().removeItem(0);

    expect(store().selectedIndex).toBeNull();
  });
});

describe("toLayout", () => {
  it("§2.3 레이아웃 JSON 모양 그대로 뽑아낸다", () => {
    place(HANGER.id, 2, 1);
    place(SHOWCASE.id, 5, 3, 90);

    expect(store().toLayout()).toEqual({
      gridCols: 10,
      gridRows: 6,
      cellSizeMm: 500,
      items: [
        { fixtureId: HANGER.id, col: 2, row: 1, rotation: 0 },
        { fixtureId: SHOWCASE.id, col: 5, row: 3, rotation: 90 },
      ],
    });
  });
});
