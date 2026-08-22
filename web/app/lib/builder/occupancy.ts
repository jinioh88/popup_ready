import type { Rotation } from "../schemas/layout";
import type { CellCoord, FixtureSpec, Placement } from "./types";

/**
 * 집기 점유 셀 계산 — **백엔드 서버측 재검증과 완전히 동일해야 하는 계산식**이다
 * (sprint1.md §2.3). 한쪽만 고치면 정상 배치가 400으로 거절된다.
 *
 *   점유 셀 수 = ceil(width_mm / cellSizeMm) × ceil(depth_mm / cellSizeMm)
 *   rotation이 90/270이면 폭·깊이를 스왑한다.
 */

/** 회전이 반영된 점유 크기(셀 단위). */
export function occupiedSize(
  fixture: Pick<FixtureSpec, "widthMm" | "depthMm">,
  cellSizeMm: number,
  rotation: Rotation,
): { cols: number; rows: number } {
  const cols = Math.ceil(fixture.widthMm / cellSizeMm);
  const rows = Math.ceil(fixture.depthMm / cellSizeMm);

  return isSwapped(rotation) ? { cols: rows, rows: cols } : { cols, rows };
}

/** 점유 셀 개수. */
export function occupiedCellCount(
  fixture: Pick<FixtureSpec, "widthMm" | "depthMm">,
  cellSizeMm: number,
  rotation: Rotation,
): number {
  const { cols, rows } = occupiedSize(fixture, cellSizeMm, rotation);
  return cols * rows;
}

/** 배치 위치 + 집기 규격 → 점유 사각형. */
export function toPlacement(
  origin: CellCoord,
  fixture: Pick<FixtureSpec, "widthMm" | "depthMm">,
  cellSizeMm: number,
  rotation: Rotation,
): Placement {
  const { cols, rows } = occupiedSize(fixture, cellSizeMm, rotation);
  return { col: origin.col, row: origin.row, cols, rows };
}

/** 점유 사각형이 덮는 셀 좌표 목록. 시각적 하이라이트용 — 판정에는 사각형 겹침을 쓴다. */
export function placementCells(placement: Placement): CellCoord[] {
  const cells: CellCoord[] = [];

  for (let row = placement.row; row < placement.row + placement.rows; row += 1) {
    for (let col = placement.col; col < placement.col + placement.cols; col += 1) {
      cells.push({ col, row });
    }
  }

  return cells;
}

function isSwapped(rotation: Rotation): boolean {
  return rotation === 90 || rotation === 270;
}
