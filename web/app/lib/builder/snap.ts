import type { CellCoord } from "./types";

/**
 * 픽셀 좌표 ↔ 셀 좌표 환산.
 *
 * 스토어에는 셀 좌표만 보관하므로(web/CLAUDE.md 상태 관리 분담), 픽셀은 이 함수를
 * 통과하는 순간에만 존재한다. 그리드 범위 판정은 하지 않는다 — 그것은 collision의 몫이다.
 */

/** 픽셀 좌표를 가장 가까운 셀 좌표로 스냅한다. 경계에 걸치면 큰 쪽으로 붙는다. */
export function snapToCell(x: number, y: number, cellSizePx: number): CellCoord {
  return {
    col: normalizeZero(Math.round(x / cellSizePx)),
    row: normalizeZero(Math.round(y / cellSizePx)),
  };
}

/** 셀 좌표를 캔버스 픽셀 좌표(셀의 좌상단)로 환산한다. */
export function cellToPixel(cell: CellCoord, cellSizePx: number): { x: number; y: number } {
  return {
    x: cell.col * cellSizePx,
    y: cell.row * cellSizePx,
  };
}

/** `Math.round(-0.4)`는 -0을 돌려준다. 셀 좌표에 -0이 새면 직렬화 결과가 흔들린다. */
function normalizeZero(value: number): number {
  return value === 0 ? 0 : value;
}
