import { resolveDropAtCell } from "./drop";
import type { CellCoord, FixtureLookup, Placement } from "./types";
import type { GridSpec } from "../schemas/layout";

/**
 * 키보드 배치 초안이 **어느 칸에서 시작할지** 고른다 (sprint2-web.md §8.17).
 *
 * **왜 이 함수가 생겼는가.** 초안이 무조건 `(0, 0)`에서 시작했다. 빈 캔버스를 전제한 동작이라,
 * 사용자가 캔버스를 거의 채운 상태에서 집기를 하나 더 집으면 초안이 **이미 점유된 (0,0)에
 * 빨간 무효 블록으로** 떴다. 보고 있던 곳이 아닌 화면 구석에, 빨간색으로.
 * 그래서 `R`을 눌러도 "저쪽 빨간 네모만 바뀐다"로 읽혔고 **고장으로 보였다.**
 *
 * **지금 빨강이 나쁜 이유는 빨개서가 아니라 거짓말이어서다** — "시작 위치를 잘못 골랐다"를
 * "놓을 데가 없다"로 보여주고 있었다. 그래서 이 함수는 **빨강을 없애지 않는다.**
 * 놓을 자리가 정말 없으면 `(0, 0)`을 돌려주고, 그때 빨간 것은 **참말이다.**
 *
 * **판정은 `resolveDropAtCell`을 그대로 쓴다.** 여기서 충돌을 다시 계산하면 판정이 두 벌이 되고,
 * 그러면 "초안은 여기서 시작했는데 확정은 거부되는" 자리가 생긴다.
 */

export type DraftStartInput = {
  fixtureId: number;
  fixtures: FixtureLookup;
  grid: GridSpec;
  existing: readonly Placement[];
  /**
   * 지금 선택된 집기의 좌상단 칸. **여기 다음 칸부터 찾는다.**
   *
   * `placeItem`이 배치 직후 선택을 남기므로 **연속 배치가 기본 경로**다 —
   * 방금 놓은 집기 옆이 다음 자리일 확률이 높고, 무엇보다 **사용자 시선이 이미 거기 있다.**
   * 없으면 `(0, 0)`부터 훑는다.
   */
  from?: CellCoord;
};

/**
 * 놓을 수 있는 첫 칸. 없으면 `(0, 0)`.
 *
 * 행 우선으로 훑되 `from` 다음 칸에서 시작해 **한 바퀴 돌아** 그 앞까지 본다 —
 * 선택이 오른쪽 끝에 있어도 왼쪽 빈자리를 찾아낸다.
 *
 * 비용은 문제가 아니다. 그리드는 수백 칸 규모이고, 이 함수는 드래그 중이 아니라
 * **초안 생성이라는 이산 사건**에서 한 번 돈다(150ms 스로틀 게이트와 무관하다).
 */
export function findDraftStartCell(input: DraftStartInput): CellCoord {
  const { grid, from } = input;
  const total = grid.gridCols * grid.gridRows;

  if (total <= 0) {
    return { col: 0, row: 0 };
  }

  const offset = from ? indexOf(from, grid) + 1 : 0;

  for (let step = 0; step < total; step += 1) {
    const cell = cellAt((offset + step) % total, grid);
    const resolution = resolveDropAtCell({
      fixtureId: input.fixtureId,
      fixtures: input.fixtures,
      cell,
      grid: input.grid,
      existing: input.existing,
    });

    // `ok: false`는 집기 규격을 못 찾은 경우다 — 어느 칸에서도 같으므로 더 볼 것이 없다.
    if (!resolution.ok) {
      break;
    }

    if (resolution.valid) {
      return cell;
    }
  }

  // 놓을 자리가 없다. `(0, 0)`에서 빨갛게 뜨는 것이 **이 상태의 정직한 표현**이다.
  return { col: 0, row: 0 };
}

function indexOf(cell: CellCoord, grid: GridSpec): number {
  return cell.row * grid.gridCols + cell.col;
}

function cellAt(index: number, grid: GridSpec): CellCoord {
  return { col: index % grid.gridCols, row: Math.floor(index / grid.gridCols) };
}
