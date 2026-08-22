import type { GridSpec } from "../schemas/layout";
import type { Placement } from "./types";

/**
 * 충돌 판정 — (a) 그리드 범위 밖 배치 불가, (b) 다른 집기 점유 셀과 겹침 불가.
 * 겹치는 위치는 드롭 자체를 거부하고 시각적 피드백을 준다(sprint1.md §3 US-102).
 */

/**
 * 거부 사유. 렌더 계층이 이 값으로 피드백 문구를 고르므로 사유를 뭉뚱그리지 않는다.
 * `UNKNOWN_FIXTURE`는 집기 카탈로그가 아직 없어 **판정 자체가 불가능**한 상태다.
 */
export type PlacementRejection = "OUT_OF_BOUNDS" | "OVERLAP" | "UNKNOWN_FIXTURE";

export type PlacementCheck =
  { ok: true } | { ok: false; reason: PlacementRejection; collidingIndexes: number[] };

/** 점유 사각형이 그리드 안에 완전히 들어가는가. */
export function isInsideGrid(placement: Placement, grid: Pick<GridSpec, "gridCols" | "gridRows">) {
  return (
    placement.col >= 0 &&
    placement.row >= 0 &&
    placement.col + placement.cols <= grid.gridCols &&
    placement.row + placement.rows <= grid.gridRows
  );
}

/** 두 점유 사각형이 한 셀이라도 겹치는가. 맞닿기만 하는 것은 겹침이 아니다. */
export function overlaps(a: Placement, b: Placement): boolean {
  return (
    a.col < b.col + b.cols &&
    b.col < a.col + a.cols &&
    a.row < b.row + b.rows &&
    b.row < a.row + a.rows
  );
}

/**
 * 배치 가능 여부.
 *
 * `ignoreIndex`는 이미 배치된 집기를 옮기거나 회전시킬 때 자기 자신을 제외하기 위한 것이다
 * — 넘기지 않으면 항상 자기 자신과 겹쳐 거부된다.
 */
export function canPlace(
  candidate: Placement,
  existing: readonly Placement[],
  grid: Pick<GridSpec, "gridCols" | "gridRows">,
  ignoreIndex?: number,
): PlacementCheck {
  if (!isInsideGrid(candidate, grid)) {
    return { ok: false, reason: "OUT_OF_BOUNDS", collidingIndexes: [] };
  }

  const collidingIndexes = existing.reduce<number[]>((acc, placement, index) => {
    if (index !== ignoreIndex && overlaps(candidate, placement)) {
      acc.push(index);
    }
    return acc;
  }, []);

  if (collidingIndexes.length > 0) {
    return { ok: false, reason: "OVERLAP", collidingIndexes };
  }

  return { ok: true };
}
