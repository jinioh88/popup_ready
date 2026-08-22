import { canPlace, type PlacementRejection } from "./collision";
import { toPlacement } from "./occupancy";
import { snapToCell } from "./snap";
import type { FixtureLookup, Placement } from "./types";
import type { GridSpec } from "../schemas/layout";

/**
 * 캔버스 드롭 지점 해석 — 픽셀 좌표를 받아 "어디에 놓이는가 / 놓을 수 있는가"를 판정한다.
 *
 * 렌더 계층에 있던 판정을 여기로 내려, 드래그 미리보기와 실제 드롭이 **같은 함수**를 쓰게 한다.
 * 미리보기에서 초록이던 자리가 드롭에서 거부되는 식으로 둘이 갈라지지 않는다.
 *
 * 범위 밖·겹침은 `ok: true, valid: false`다 — 자리는 계산됐고 빨간 하이라이트로 보여줘야 하기
 * 때문이다. `ok: false`는 **판정 자체가 불가능한 경우**(집기 규격을 못 찾음)뿐이다.
 */
export type DropResolution =
  { ok: true; placement: Placement; valid: boolean } | { ok: false; reason: PlacementRejection };

export function resolveDrop(input: {
  fixtureId: number;
  fixtures: FixtureLookup;
  /** 캔버스 좌상단 기준 픽셀 좌표 */
  x: number;
  y: number;
  /** 셀 하나의 화면 크기(px) */
  cellPx: number;
  grid: GridSpec;
  existing: readonly Placement[];
}): DropResolution {
  const spec = input.fixtures[input.fixtureId];

  if (!spec) {
    return { ok: false, reason: "UNKNOWN_FIXTURE" };
  }

  const cell = snapToCell(input.x, input.y, input.cellPx);
  const placement = toPlacement(cell, spec, input.grid.cellSizeMm, 0);

  return { ok: true, placement, valid: canPlace(placement, input.existing, input.grid).ok };
}
