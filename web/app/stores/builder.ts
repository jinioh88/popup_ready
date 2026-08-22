import { create } from "zustand";

import type { GridSpec, Layout, LayoutItem, Rotation } from "../lib/schemas/layout";
import { canPlace, type PlacementCheck } from "../lib/builder/collision";
import { toPlacement } from "../lib/builder/occupancy";
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

export type BuilderState = {
  grid: GridSpec;
  items: LayoutItem[];
  selectedIndex: number | null;

  /** `GET /spaces/{id}`의 grid 정보로 캔버스를 초기화한다. 기존 배치는 비운다. */
  initGrid: (grid: GridSpec) => void;
  selectItem: (index: number | null) => void;
  placeItem: (item: LayoutItem, fixtures: FixtureLookup) => PlacementCheck;
  moveItem: (index: number, col: number, row: number, fixtures: FixtureLookup) => PlacementCheck;
  rotateItem: (index: number, fixtures: FixtureLookup) => PlacementCheck;
  removeItem: (index: number) => void;
  reset: () => void;

  /** 예약 요청(`POST /reservation-requests`)에 실어 보낼 §2.3 레이아웃 JSON. */
  toLayout: () => Layout;
};

const UNKNOWN_FIXTURE: PlacementCheck = {
  ok: false,
  reason: "UNKNOWN_FIXTURE",
  collidingIndexes: [],
};

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
  grid: DEFAULT_GRID,
  items: [],
  selectedIndex: null,

  // 같은 그리드로 다시 호출해도 배치를 날리지 않는다 — 쿼리 재요청·리렌더로 사용자의
  // 작업이 통째로 사라지는 사고를 막기 위한 멱등 처리다.
  initGrid: (grid) =>
    set((state) =>
      isSameGrid(state.grid, grid) ? state : { grid, items: [], selectedIndex: null },
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

  reset: () => set({ grid: DEFAULT_GRID, items: [], selectedIndex: null }),

  toLayout: () => {
    const { grid, items } = get();
    return { ...grid, items };
  },
}));
