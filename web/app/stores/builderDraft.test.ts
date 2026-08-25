import { beforeEach, describe, expect, it } from "vitest";

import { useBuilderStore } from "./builder";
import type { FixtureLookup } from "../lib/builder/types";

/** 키보드 배치 초안 (sprint2-web.md I-1). */

const FIXTURES: FixtureLookup = {
  // 1000×500mm → 2×1칸
  1: { id: 1, widthMm: 1000, depthMm: 500, powerWatt: 100, dailyRentalFee: 0 },
  2: { id: 2, widthMm: 500, depthMm: 500, powerWatt: 0, dailyRentalFee: 0 },
};

const store = () => useBuilderStore.getState();

beforeEach(() => {
  store().reset();
  store().initGrid(1, { gridCols: 10, gridRows: 10, cellSizeMm: 500 });
});

describe("배치 초안 — 시작·취소", () => {
  it("빈 캔버스에서는 좌상단에 놓인다", () => {
    store().startDraft(1, FIXTURES);

    expect(store().draft).toEqual({ fixtureId: 1, col: 0, row: 0, rotation: 0 });
  });

  it("취소하면 사라지고 배치는 늘지 않는다", () => {
    store().startDraft(1, FIXTURES);
    store().cancelDraft();

    expect(store().draft).toBeNull();
    expect(store().items).toHaveLength(0);
  });

  it("상가가 바뀌면 초안도 버린다", () => {
    // 이전 상가 도면에 놓으려던 집기가 다른 상가로 넘어가면 안 된다.
    store().startDraft(1, FIXTURES);
    store().initGrid(2, { gridCols: 8, gridRows: 8, cellSizeMm: 500 });

    expect(store().draft).toBeNull();
  });
});

describe("배치 초안 — 이동", () => {
  it("방향키만큼 셀 단위로 옮긴다", () => {
    store().startDraft(1, FIXTURES);
    store().moveDraft(3, 2);

    expect(store().draft).toMatchObject({ col: 3, row: 2 });
  });

  it("그리드 밖으로는 나가지 않고 가장자리에 멈춘다", () => {
    // 화면 밖에서 길을 잃는 것보다 붙어 멈추는 편이 낫다.
    store().startDraft(1, FIXTURES);
    store().moveDraft(-5, -5);

    expect(store().draft).toMatchObject({ col: 0, row: 0 });

    store().moveDraft(100, 100);

    expect(store().draft).toMatchObject({ col: 9, row: 9 });
  });

  it("초안이 없으면 아무 일도 없다", () => {
    store().moveDraft(1, 1);

    expect(store().draft).toBeNull();
  });
});

describe("배치 초안 — 회전", () => {
  it("R을 누를 때마다 90도씩 돈다", () => {
    store().startDraft(1, FIXTURES);

    store().rotateDraft();
    expect(store().draft).toMatchObject({ rotation: 90 });

    store().rotateDraft();
    store().rotateDraft();
    store().rotateDraft();
    expect(store().draft).toMatchObject({ rotation: 0 });
  });

  it("확정 전 회전은 겹침과 무관하게 허용된다", () => {
    // 돌려보다가 막히면 어디로도 못 간다 — 판정은 확정 시점에 한다.
    store().placeItem({ fixtureId: 1, col: 0, row: 0, rotation: 0 }, FIXTURES);
    store().startDraft(1, FIXTURES);
    store().rotateDraft();

    expect(store().draft).toMatchObject({ rotation: 90 });
  });
});

describe("배치 초안 — 확정", () => {
  it("확정하면 배치에 들어가고 초안은 비워진다", () => {
    store().startDraft(1, FIXTURES);
    store().moveDraft(2, 2);
    store().rotateDraft();

    const check = store().commitDraft(FIXTURES);

    expect(check.ok).toBe(true);
    expect(store().draft).toBeNull();
    expect(store().items).toEqual([{ fixtureId: 1, col: 2, row: 2, rotation: 90 }]);
  });

  it("겹치면 확정되지 않고 초안이 남는다", () => {
    // 사유를 보고 옮겨서 다시 시도할 수 있어야 한다 — 초안을 버리면 처음부터 다시다.
    store().placeItem({ fixtureId: 1, col: 0, row: 0, rotation: 0 }, FIXTURES);
    store().startDraft(2, FIXTURES);

    /*
     * **초안을 일부러 점유된 칸으로 옮긴다.** 예전에는 시작 칸이 무조건 (0,0)이라 저절로
     * 겹쳤고, 이 테스트는 그 우연에 기대고 있었다. 이제는 빈 칸에서 시작하므로(§8.17)
     * 겹침을 보려면 만들어야 한다 — 전제를 코드에 드러내는 편이 낫다.
     */
    const draft = store().draft!;
    store().moveDraft(-draft.col, -draft.row);

    const check = store().commitDraft(FIXTURES);

    expect(check).toMatchObject({ ok: false, reason: "OVERLAP" });
    expect(store().draft).not.toBeNull();
    expect(store().items).toHaveLength(1);
  });

  it("범위를 벗어나면 확정되지 않는다", () => {
    store().startDraft(1, FIXTURES); // 2칸짜리
    store().moveDraft(9, 0); // 마지막 열 → 오른쪽으로 삐져나간다

    expect(store().commitDraft(FIXTURES)).toMatchObject({ ok: false, reason: "OUT_OF_BOUNDS" });
    expect(store().items).toHaveLength(0);
  });

  it("초안 없이 확정하면 판정 불가로 떨어진다", () => {
    expect(store().commitDraft(FIXTURES)).toMatchObject({ ok: false, reason: "UNKNOWN_FIXTURE" });
  });

  it("확정 경로가 드래그 드롭과 같은 함수를 쓴다", () => {
    // commitDraft가 placeItem을 거치므로, 드롭으로 만든 결과와 구별할 수 없어야 한다.
    store().startDraft(1, FIXTURES);
    store().moveDraft(4, 4);
    store().commitDraft(FIXTURES);

    const viaKeyboard = store().items;

    store().reset();
    store().initGrid(1, { gridCols: 10, gridRows: 10, cellSizeMm: 500 });
    store().placeItem({ fixtureId: 1, col: 4, row: 4, rotation: 0 }, FIXTURES);

    expect(viaKeyboard).toEqual(store().items);
  });
});

describe("배치 초안 — 시작 칸 고르기 (재실행 D-1 발견, §8.17)", () => {
  it("좌상단이 차 있으면 거기서 시작하지 않는다", () => {
    /*
     * 결함의 얼굴. 사용자가 면적 70%를 넘기려고 캔버스를 거의 채운 상태에서 집기를 하나 더
     * 집었더니, 초안이 **이미 점유된 (0,0)에 빨간 무효 블록**으로 떴다. 보고 있던 곳이 아닌
     * 화면 구석에, 빨간색으로. R을 눌러도 "저쪽 빨간 네모만 바뀐다"로 읽혀 고장으로 보였다.
     */
    store().placeItem({ fixtureId: 1, col: 0, row: 0, rotation: 0 }, FIXTURES);
    store().startDraft(2, FIXTURES);

    expect(store().draft).not.toMatchObject({ col: 0, row: 0 });
  });

  it("방금 놓은 집기 다음 칸에서 시작한다", () => {
    // placeItem이 배치 직후 선택을 남기므로 연속 배치가 기본 경로다 — 사용자 시선이 거기 있다.
    store().placeItem({ fixtureId: 2, col: 4, row: 4, rotation: 0 }, FIXTURES);
    store().startDraft(2, FIXTURES);

    expect(store().draft).toMatchObject({ col: 5, row: 4 });
  });

  it("고른 칸은 실제로 놓을 수 있는 자리다 — 초안과 확정이 갈라지지 않는다", () => {
    // 자리 탐색이 resolveDropAtCell을 공유하므로, 시작 칸에서 Enter를 누르면 반드시 놓인다.
    store().placeItem({ fixtureId: 1, col: 0, row: 0, rotation: 0 }, FIXTURES);
    store().startDraft(1, FIXTURES);

    expect(store().commitDraft(FIXTURES).ok).toBe(true);
  });

  it("놓을 자리가 없으면 (0,0)이다 — 그때 빨간 것은 참말이다", () => {
    // 빨강을 없애는 수정이 아니다. "시작 위치를 잘못 골랐다"를 "놓을 데가 없다"로 보여주던
    // 것이 문제였고, 정말 놓을 데가 없을 때는 빨간 것이 맞다.
    store().reset();
    store().initGrid(1, { gridCols: 1, gridRows: 1, cellSizeMm: 500 });
    store().placeItem({ fixtureId: 2, col: 0, row: 0, rotation: 0 }, FIXTURES);

    store().startDraft(2, FIXTURES);

    expect(store().draft).toMatchObject({ col: 0, row: 0 });
  });
});
