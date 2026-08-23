import { useMemo, useState } from "react";
import { Group, Layer, Line, Rect, Stage, Text } from "react-konva";

import { readDraggedFixtureId } from "../../lib/builder/dragTransfer";
import { resolveDrop } from "../../lib/builder/drop";
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
      className="inline-block rounded-xl border border-border bg-surface p-2"
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
          <Rect x={0} y={0} width={width} height={height} fill={CANVAS_COLORS.surface} />
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

        {/* 드롭 미리보기 — 겹치거나 범위를 벗어나면 빨간 하이라이트. */}
        <Layer listening={false}>
          {preview ? (
            <Rect
              {...cellToPixel(preview.placement, CELL_PX)}
              width={preview.placement.cols * CELL_PX}
              height={preview.placement.rows * CELL_PX}
              fill={preview.valid ? CANVAS_COLORS.fixture : CANVAS_COLORS.invalid}
              opacity={preview.valid ? 0.7 : 0.35}
              stroke={preview.valid ? CANVAS_COLORS.fixtureBorder : CANVAS_COLORS.invalid}
              strokeWidth={2}
              cornerRadius={4}
            />
          ) : null}
        </Layer>
      </Stage>
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
