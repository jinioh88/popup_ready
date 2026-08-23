import { canPlace, type PlacementRejection } from "./collision";
import { toPlacement } from "./occupancy";
import { snapToCell } from "./snap";
import type { CellCoord, FixtureLookup, Placement } from "./types";
import type { GridSpec, Rotation } from "../schemas/layout";

/**
 * 배치 지점 해석 — "어디에 놓이는가 / 놓을 수 있는가"를 판정한다.
 *
 * 렌더 계층에 있던 판정을 여기로 내려, 드래그 미리보기와 실제 드롭이 **같은 함수**를 쓰게 한다.
 * 미리보기에서 초록이던 자리가 드롭에서 거부되는 식으로 둘이 갈라지지 않는다.
 *
 * **입력 경로가 둘이다**(US-103 이월분, sprint2-web.md I-1).
 *
 *   마우스   픽셀 좌표 → `resolveDrop()`   → snapToCell → resolveDropAtCell
 *   키보드   셀 좌표   → `resolveDropAtCell()`
 *
 * 픽셀 경로는 **스냅만 하고** 같은 판정 함수로 들어온다. 키보드 경로가 자체 충돌 판정을 갖는
 * 순간 두 입력이 갈라지고, 마우스로는 되는 자리가 키보드로는 거부되기 시작한다.
 *
 * 범위 밖·겹침은 `ok: true, valid: false`다 — 자리는 계산됐고 빨간 하이라이트로 보여줘야 하기
 * 때문이다. `ok: false`는 **판정 자체가 불가능한 경우**(집기 규격을 못 찾음)뿐이다.
 */
export type DropResolution =
  { ok: true; placement: Placement; valid: boolean } | { ok: false; reason: PlacementRejection };

export type ResolveAtCellInput = {
  fixtureId: number;
  fixtures: FixtureLookup;
  /** 놓을 자리(좌상단 셀). */
  cell: CellCoord;
  grid: GridSpec;
  existing: readonly Placement[];
  /** 회전. 키보드 경로는 배치 전에 돌릴 수 있다. */
  rotation?: Rotation;
  /**
   * 판정에서 제외할 기존 배치의 인덱스. 이미 놓인 집기를 옮길 때 **자기 자신과의 겹침**을
   * 겹침으로 세지 않기 위한 것이다.
   */
  ignoreIndex?: number;
};

/** 셀 좌표 기준 판정. 두 입력 경로가 최종적으로 만나는 지점이다. */
export function resolveDropAtCell(input: ResolveAtCellInput): DropResolution {
  const spec = input.fixtures[input.fixtureId];

  if (!spec) {
    return { ok: false, reason: "UNKNOWN_FIXTURE" };
  }

  const placement = toPlacement(input.cell, spec, input.grid.cellSizeMm, input.rotation ?? 0);
  const check = canPlace(placement, input.existing, input.grid, input.ignoreIndex);

  return { ok: true, placement, valid: check.ok };
}

export type ResolveDropInput = Omit<ResolveAtCellInput, "cell"> & {
  /** 캔버스 좌상단 기준 픽셀 좌표 */
  x: number;
  y: number;
  /** 셀 하나의 화면 크기(px) */
  cellPx: number;
};

/** 픽셀 좌표 기준 판정. 스냅한 뒤 `resolveDropAtCell`에 그대로 넘긴다. */
export function resolveDrop({ x, y, cellPx, ...rest }: ResolveDropInput): DropResolution {
  return resolveDropAtCell({ ...rest, cell: snapToCell(x, y, cellPx) });
}
