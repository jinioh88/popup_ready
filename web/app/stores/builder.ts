import { create } from "zustand";

import type { GridSpec, Layout, LayoutItem, Rotation } from "../lib/schemas/layout";
import { canPlace, type PlacementCheck } from "../lib/builder/collision";
import { toPlacement } from "../lib/builder/occupancy";
import { findDraftStartCell } from "../lib/builder/draftStart";
import type { FixtureLookup, Placement } from "../lib/builder/types";

/**
 * 2D 빌더 캔버스 상태 (US-102).
 *
 * - 배치 목록은 **셀 좌표**(sprint1.md §2.3 레이아웃 스키마)로만 보관한다. 픽셀 좌표는
 *   렌더 계층(app/features)에서 환산하고 여기 저장하지 않는다.
 * - 집기 카탈로그(`GET /fixtures`)는 서버 상태라 TanStack Query가 소유한다. 이 스토어에
 *   복제하지 않고, 배치 판정이 필요한 액션이 `FixtureLookup`을 인자로 받는다.
 * - 배치·이동·회전은 충돌 시 상태를 바꾸지 않고 거부 사유를 돌려준다.
 */

const DEFAULT_GRID: GridSpec = { gridCols: 0, gridRows: 0, cellSizeMm: 0 };

/**
 * 키보드로 배치 중인 집기 (I-1).
 *
 * 확정 전의 임시 상태다 — `items`에 들어가기 전이라 예약 요청에 실리지 않는다.
 * 픽셀이 아니라 **셀 좌표**로 보관하는 것은 `items`와 같은 이유다.
 */
export type PlacementDraft = {
  fixtureId: number;
  col: number;
  row: number;
  rotation: Rotation;
};

export type BuilderState = {
  /** 이 배치가 어느 상가의 도면인지. 다른 상가로 넘어가면 배치를 이어받지 않는다. */
  spaceId: number | null;
  grid: GridSpec;
  items: LayoutItem[];
  selectedIndex: number | null;

  /**
   * 키보드 배치 중인 집기. `null`이면 배치 모드가 아니다.
   *
   * **드래그 경로에는 이 상태가 없다** — HTML5 드래그는 브라우저가 끌리는 것을 들고 있고
   * 미리보기는 `BuilderCanvas`의 지역 상태다. 키보드는 들고 있어 줄 주체가 없어서 여기 둔다.
   */
  draft: PlacementDraft | null;

  /**
   * `GET /spaces/{id}`의 grid 정보로 캔버스를 초기화한다.
   *
   * 같은 상가·같은 그리드로 다시 불러도 배치를 유지하고(쿼리 재요청·리렌더로 작업이 날아가면
   * 안 된다), **상가가 바뀌면 그리드 규격이 우연히 같더라도 비운다** — 이전 상가에 놓은 집기가
   * 남은 채 제출되면 다른 상가의 도면으로 예약이 만들어진다.
   */
  initGrid: (spaceId: number, grid: GridSpec) => void;
  selectItem: (index: number | null) => void;
  placeItem: (item: LayoutItem, fixtures: FixtureLookup) => PlacementCheck;
  moveItem: (index: number, col: number, row: number, fixtures: FixtureLookup) => PlacementCheck;
  rotateItem: (index: number, fixtures: FixtureLookup) => PlacementCheck;
  removeItem: (index: number) => void;
  reset: () => void;

  /** 팔레트에서 Enter/Space — 배치 모드로 들어간다. 시작 자리는 좌상단(0,0)이다. */
  startDraft: (fixtureId: number, fixtures: FixtureLookup) => void;
  /** 방향키 — 셀 단위로 옮긴다. 범위 밖으로는 나가지 않는다(거부가 아니라 멈춤). */
  moveDraft: (colDelta: number, rowDelta: number) => void;
  /** R — 확정 전에 돌린다. 회전은 겹침과 무관하게 항상 허용된다(확정 시 판정). */
  rotateDraft: () => void;
  /** Enter — 확정. 충돌하면 상태를 바꾸지 않고 사유를 돌려준다. */
  commitDraft: (fixtures: FixtureLookup) => PlacementCheck;
  /** Esc — 취소. */
  cancelDraft: () => void;

  /** 예약 요청(`POST /reservation-requests`)에 실어 보낼 §2.3 레이아웃 JSON. */
  toLayout: () => Layout;
};

const UNKNOWN_FIXTURE: PlacementCheck = {
  ok: false,
  reason: "UNKNOWN_FIXTURE",
  collidingIndexes: [],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** rotation을 시계 방향으로 한 단계(90도) 돌린다. */
export function nextRotation(rotation: Rotation): Rotation {
  return ((rotation + 90) % 360) as Rotation;
}

/**
 * 배치 목록을 점유 사각형으로 환산한다.
 *
 * 규격을 하나라도 못 찾으면 `null`을 돌려준다 — 그 집기를 빼고 판정하면 겹치는 자리를
 * 빈 자리로 오인해 통과시키고, 서버 재검증에서 400으로 되돌아온다. 조용히 넘기지 않는다.
 */
function toPlacements(
  items: readonly LayoutItem[],
  cellSizeMm: number,
  fixtures: FixtureLookup,
): Placement[] | null {
  const placements: Placement[] = [];

  for (const item of items) {
    const spec = fixtures[item.fixtureId];

    if (!spec) {
      return null;
    }

    placements.push(toPlacement(item, spec, cellSizeMm, item.rotation));
  }

  return placements;
}

function isSameGrid(a: GridSpec, b: GridSpec): boolean {
  return a.gridCols === b.gridCols && a.gridRows === b.gridRows && a.cellSizeMm === b.cellSizeMm;
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
  spaceId: null,
  grid: DEFAULT_GRID,
  items: [],
  selectedIndex: null,
  draft: null,

  initGrid: (spaceId, grid) =>
    set((state) =>
      state.spaceId === spaceId && isSameGrid(state.grid, grid)
        ? state
        : { spaceId, grid, items: [], selectedIndex: null, draft: null },
    ),

  selectItem: (index) => set({ selectedIndex: index }),

  placeItem: (item, fixtures) => {
    const { grid, items } = get();
    const spec = fixtures[item.fixtureId];

    if (!spec) {
      return UNKNOWN_FIXTURE;
    }

    const existing = toPlacements(items, grid.cellSizeMm, fixtures);

    if (!existing) {
      return UNKNOWN_FIXTURE;
    }

    const candidate = toPlacement(item, spec, grid.cellSizeMm, item.rotation);
    const check = canPlace(candidate, existing, grid);

    if (check.ok) {
      set({ items: [...items, item], selectedIndex: items.length });
    }

    return check;
  },

  moveItem: (index, col, row, fixtures) => {
    const { grid, items } = get();
    const target = items[index];
    const spec = target ? fixtures[target.fixtureId] : undefined;

    if (!target || !spec) {
      return UNKNOWN_FIXTURE;
    }

    const existing = toPlacements(items, grid.cellSizeMm, fixtures);

    if (!existing) {
      return UNKNOWN_FIXTURE;
    }

    const candidate = toPlacement({ col, row }, spec, grid.cellSizeMm, target.rotation);
    const check = canPlace(candidate, existing, grid, index);

    if (check.ok) {
      set({ items: items.map((item, i) => (i === index ? { ...item, col, row } : item)) });
    }

    return check;
  },

  rotateItem: (index, fixtures) => {
    const { grid, items } = get();
    const target = items[index];
    const spec = target ? fixtures[target.fixtureId] : undefined;

    if (!target || !spec) {
      return UNKNOWN_FIXTURE;
    }

    const existing = toPlacements(items, grid.cellSizeMm, fixtures);

    if (!existing) {
      return UNKNOWN_FIXTURE;
    }

    const rotation = nextRotation(target.rotation);
    const candidate = toPlacement(target, spec, grid.cellSizeMm, rotation);
    const check = canPlace(candidate, existing, grid, index);

    if (check.ok) {
      set({ items: items.map((item, i) => (i === index ? { ...item, rotation } : item)) });
    }

    return check;
  },

  removeItem: (index) =>
    set((state) => ({
      items: state.items.filter((_, i) => i !== index),
      selectedIndex: state.selectedIndex === index ? null : state.selectedIndex,
    })),

  reset: () =>
    set({ spaceId: null, grid: DEFAULT_GRID, items: [], selectedIndex: null, draft: null }),

  /**
   * 키보드 배치 초안을 띄운다.
   *
   * **시작 칸을 고르는 것이 이 액션의 실질이다**(§8.17). 예전엔 무조건 `(0, 0)`이었고,
   * 캔버스가 차 있으면 화면 구석에 **빨간 무효 블록**으로 떠서 고장으로 읽혔다.
   * 자리 탐색은 `findDraftStartCell`이 하고 판정은 `resolveDropAtCell`을 공유한다.
   *
   * `fixtures`를 받는 이유가 이것이다 — 어디에 놓을 수 있는지 알려면 집기 규격이 필요하다.
   */
  startDraft: (fixtureId, fixtures) => {
    const { grid, items, selectedIndex } = get();
    const existing = toPlacements(items, grid.cellSizeMm, fixtures);
    const selected = selectedIndex === null ? undefined : items[selectedIndex];

    const cell = existing
      ? findDraftStartCell({
          fixtureId,
          fixtures,
          grid,
          existing,
          // 방금 놓은 집기 옆이 다음 자리일 확률이 높고, 사용자 시선도 거기 있다.
          from: selected ? { col: selected.col, row: selected.row } : undefined,
        })
      : { col: 0, row: 0 };

    set({ draft: { fixtureId, col: cell.col, row: cell.row, rotation: 0 } });
  },

  moveDraft: (colDelta, rowDelta) =>
    set((state) => {
      if (!state.draft) {
        return state;
      }

      // 범위 밖으로는 나가지 않는다. 방향키를 계속 눌렀을 때 화면 밖에서 길을 잃는 것보다
      // 가장자리에 붙어 멈추는 편이 낫다 — 확정 시 판정은 그대로 `resolveDropAtCell`이 한다.
      const col = clamp(state.draft.col + colDelta, 0, Math.max(state.grid.gridCols - 1, 0));
      const row = clamp(state.draft.row + rowDelta, 0, Math.max(state.grid.gridRows - 1, 0));

      return col === state.draft.col && row === state.draft.row
        ? state
        : { draft: { ...state.draft, col, row } };
    }),

  rotateDraft: () =>
    set((state) =>
      state.draft
        ? { draft: { ...state.draft, rotation: nextRotation(state.draft.rotation) } }
        : state,
    ),

  commitDraft: (fixtures) => {
    const { draft } = get();

    if (!draft) {
      return UNKNOWN_FIXTURE;
    }

    // **배치 판정은 `placeItem`이 한다** — 드래그 드롭과 같은 경로다. 여기서 따로 판정하면
    // 두 입력이 갈라진다.
    const check = get().placeItem(
      { fixtureId: draft.fixtureId, col: draft.col, row: draft.row, rotation: draft.rotation },
      fixtures,
    );

    if (check.ok) {
      set({ draft: null });
    }

    return check;
  },

  cancelDraft: () => set({ draft: null }),

  toLayout: () => {
    const { grid, items } = get();
    return { ...grid, items };
  },
}));
