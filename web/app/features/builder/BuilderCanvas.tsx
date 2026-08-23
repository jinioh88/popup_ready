import { useMemo, useState } from "react";
import { Group, Layer, Line, Rect, Stage, Text } from "react-konva";

import { readDraggedFixtureId } from "../../lib/builder/dragTransfer";
import { resolveDrop, resolveDropAtCell } from "../../lib/builder/drop";
import { toPlacement } from "../../lib/builder/occupancy";
import { cellToPixel, snapToCell } from "../../lib/builder/snap";
import type { Placement } from "../../lib/builder/types";
import type { GridSpec, LayoutItem } from "../../lib/schemas/layout";
import { useBuilderStore } from "../../stores/builder";
import { CANVAS_COLORS, CELL_PX } from "./constants";
import { placementRejectionMessage } from "./messages";
import type { FixtureCatalog } from "./queries";

/**
 * 도면 그리드 캔버스 (US-102).
 *
 * **픽셀 환산은 이 계층에서만 한다.** 스토어와 `app/lib`은 셀 좌표만 다룬다.
 * 도면 이미지는 없다 — 그리드만 렌더한다(스코프 결정).
 */

type BuilderCanvasProps = {
  grid: GridSpec;
  fixtures: FixtureCatalog;
  onRejected: (reason: string) => void;
};

/** 드롭 예정 위치와 그 위치가 유효한지. 드래그 중에만 존재하는 화면 상태다. */
type DropPreview = {
  placement: Placement;
  valid: boolean;
};

export function BuilderCanvas({ grid, fixtures, onRejected }: BuilderCanvasProps) {
  const items = useBuilderStore((state) => state.items);
  const selectedIndex = useBuilderStore((state) => state.selectedIndex);
  const selectItem = useBuilderStore((state) => state.selectItem);
  const placeItem = useBuilderStore((state) => state.placeItem);
  const moveItem = useBuilderStore((state) => state.moveItem);

  const [preview, setPreview] = useState<DropPreview | null>(null);
  const draft = useBuilderStore((state) => state.draft);

  const width = grid.gridCols * CELL_PX;
  const height = grid.gridRows * CELL_PX;

  const gridLines = useMemo(() => buildGridLines(grid), [grid]);

  const placements = useMemo(
    () =>
      items.map((item) => {
        const spec = fixtures[item.fixtureId];
        return spec ? toPlacement(item, spec, grid.cellSizeMm, item.rotation) : null;
      }),
    [items, fixtures, grid.cellSizeMm],
  );

  /**
   * 키보드 배치 초안의 자리. **드래그 미리보기와 같은 판정 함수를 쓴다**(I-1) —
   * 픽셀 경로가 `snapToCell` 뒤에 부르는 것과 정확히 같은 함수다.
   */
  const draftPreview = useMemo((): DropPreview | null => {
    if (!draft) {
      return null;
    }

    const known = placements.filter((item): item is Placement => item !== null);
    const resolved = resolveDropAtCell({
      fixtureId: draft.fixtureId,
      fixtures,
      cell: { col: draft.col, row: draft.row },
      rotation: draft.rotation,
      grid,
      existing: known,
    });

    return resolved.ok ? { placement: resolved.placement, valid: resolved.valid } : null;
  }, [draft, fixtures, grid, placements]);

  // 드래그 중에는 드래그가 우선이다 — 둘이 동시에 뜨면 어느 쪽이 놓일 자리인지 알 수 없다.
  const shown = preview ?? draftPreview;

  /** 패널에서 끌어온 집기의 드롭 지점을 해석한다. 판정 로직은 app/lib에 있다. */
  function resolveAt(event: React.DragEvent<HTMLDivElement>, fixtureId: number) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const known = placements.filter((item): item is Placement => item !== null);

    return resolveDrop({
      fixtureId,
      fixtures,
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      cellPx: CELL_PX,
      grid,
      existing: known,
    });
  }

  /**
   * 끌고 있는 집기 id. **`getData()`가 아니라 `types`에서 읽는다** — dragover 단계의
   * dataTransfer는 protected mode라 값이 가려진다(`app/lib/builder/dragTransfer` 참고).
   */
  function readFixtureId(event: React.DragEvent<HTMLDivElement>): number | null {
    return readDraggedFixtureId(event.dataTransfer.types);
  }

  return (
    <div
      className="inline-block rounded-xl border border-border bg-canvas p-2"
      onDragOver={(event) => {
        const fixtureId = readFixtureId(event);

        if (fixtureId === null) {
          return;
        }

        // 기본 동작을 막아야 드롭이 허용된다 — 이걸 못 부르면 drop 이벤트 자체가 오지 않는다.
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";

        // dragover는 초당 수십 번 발생한다. 대상 셀이 그대로면 리렌더하지 않는다.
        const resolved = resolveAt(event, fixtureId);
        const next = resolved.ok ? { placement: resolved.placement, valid: resolved.valid } : null;
        setPreview((current) => (isSamePreview(current, next) ? current : next));
      }}
      onDragLeave={(event) => {
        // dragleave는 자식으로 옮겨갈 때도 올라온다 — 그때 지우면 미리보기가 깜빡인다.
        const next = event.relatedTarget;

        if (next instanceof Node && event.currentTarget.contains(next)) {
          return;
        }

        setPreview(null);
      }}
      onDrop={(event) => {
        event.preventDefault();
        const fixtureId = readFixtureId(event);
        setPreview(null);

        if (fixtureId === null) {
          return;
        }

        const dropped = resolveAt(event, fixtureId);

        if (!dropped.ok) {
          // 조용히 넘기면 사용자는 아무 일도 일어나지 않은 것으로 본다.
          onRejected(placementRejectionMessage(dropped.reason));
          return;
        }

        const item: LayoutItem = {
          fixtureId,
          col: dropped.placement.col,
          row: dropped.placement.row,
          rotation: 0,
        };

        const result = placeItem(item, fixtures);

        if (!result.ok) {
          onRejected(placementRejectionMessage(result.reason));
        }
      }}
    >
      <Stage
        width={width}
        height={height}
        onMouseDown={(event) => {
          // 빈 캔버스를 누르면 선택 해제.
          if (event.target === event.target.getStage()) {
            selectItem(null);
          }
        }}
      >
        {/* 그리드는 바뀌지 않으므로 이벤트를 받지 않는 별도 레이어에 둔다. */}
        <Layer listening={false}>
          <Rect x={0} y={0} width={width} height={height} fill={CANVAS_COLORS.background} />
          {gridLines.map((points, index) => (
            <Line key={index} points={points} stroke={CANVAS_COLORS.grid} strokeWidth={1} />
          ))}
        </Layer>

        <Layer>
          {items.map((item, index) => {
            const placement = placements[index];
            const spec = fixtures[item.fixtureId];

            if (!placement || !spec) {
              return null;
            }

            const { x, y } = cellToPixel(placement, CELL_PX);
            const isSelected = index === selectedIndex;

            return (
              <Group
                key={index}
                x={x}
                y={y}
                draggable
                onClick={() => selectItem(index)}
                onTap={() => selectItem(index)}
                onDragStart={() => selectItem(index)}
                onDragEnd={(event) => {
                  const node = event.target;
                  const cell = snapToCell(node.x(), node.y(), CELL_PX);
                  const result = moveItem(index, cell.col, cell.row, fixtures);

                  if (!result.ok) {
                    onRejected(placementRejectionMessage(result.reason));
                  }

                  // 성공이든 거부든 스토어의 셀 좌표가 진실이다 — 노드를 거기에 맞춘다.
                  const settled = useBuilderStore.getState().items[index];
                  const origin = cellToPixel(settled ?? placement, CELL_PX);
                  node.position(origin);
                }}
              >
                <Rect
                  width={placement.cols * CELL_PX}
                  height={placement.rows * CELL_PX}
                  fill={CANVAS_COLORS.fixture}
                  stroke={isSelected ? CANVAS_COLORS.selected : CANVAS_COLORS.fixtureBorder}
                  strokeWidth={isSelected ? 3 : 1.5}
                  cornerRadius={4}
                />
                <Text
                  text={spec.name}
                  width={placement.cols * CELL_PX}
                  height={placement.rows * CELL_PX}
                  align="center"
                  verticalAlign="middle"
                  fontSize={11}
                  padding={2}
                  fill={CANVAS_COLORS.text}
                  listening={false}
                />
              </Group>
            );
          })}
        </Layer>

        {/* 배치 미리보기 — 드래그와 키보드가 같은 표현을 쓴다. 겹치거나 범위를 벗어나면 빨간색. */}
        <Layer listening={false}>
          {shown ? (
            <Rect
              {...cellToPixel(shown.placement, CELL_PX)}
              width={shown.placement.cols * CELL_PX}
              height={shown.placement.rows * CELL_PX}
              fill={shown.valid ? CANVAS_COLORS.fixture : CANVAS_COLORS.invalid}
              opacity={shown.valid ? 0.7 : 0.35}
              stroke={shown.valid ? CANVAS_COLORS.fixtureBorder : CANVAS_COLORS.invalid}
              strokeWidth={2}
              cornerRadius={4}
              dash={draftPreview && !preview ? [6, 4] : undefined}
            />
          ) : null}
        </Layer>
      </Stage>

      {/*
        Konva 캔버스는 스크린리더에 아무것도 노출하지 않는다. 키보드로 배치하는 사용자에게는
        "지금 어디에 있고 놓을 수 있는지"가 유일한 피드백이므로 텍스트로 알린다.
        `polite`인 것은 방향키를 연타할 때 낭독이 서로를 끊지 않게 하기 위한 것이다.
      */}
      <p aria-live="polite" className="sr-only">
        {draftPreview
          ? `${draft?.col ?? 0}열 ${draft?.row ?? 0}행, ${draft?.rotation ?? 0}도. ${
              draftPreview.valid ? "배치할 수 있습니다." : "여기에는 놓을 수 없습니다."
            }`
          : ""}
      </p>
    </div>
  );
}

function isSamePreview(a: DropPreview | null, b: DropPreview | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }

  return (
    a.valid === b.valid &&
    a.placement.col === b.placement.col &&
    a.placement.row === b.placement.row &&
    a.placement.cols === b.placement.cols &&
    a.placement.rows === b.placement.rows
  );
}

/** 세로선·가로선 points 배열. 셀 경계마다 한 줄씩. */
function buildGridLines(grid: GridSpec): number[][] {
  const width = grid.gridCols * CELL_PX;
  const height = grid.gridRows * CELL_PX;
  const lines: number[][] = [];

  for (let col = 0; col <= grid.gridCols; col += 1) {
    lines.push([col * CELL_PX, 0, col * CELL_PX, height]);
  }

  for (let row = 0; row <= grid.gridRows; row += 1) {
    lines.push([0, row * CELL_PX, width, row * CELL_PX]);
  }

  return lines;
}
