import { useState } from "react";

import type { Fixture, FixtureCategory } from "../../lib/schemas/api";
import { fixtureDragType } from "../../lib/builder/dragTransfer";
import { useBuilderStore } from "../../stores/builder";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "./constants";

/**
 * 집기 라이브러리 패널 — 카테고리 탭 + 캔버스에 놓을 항목 목록.
 *
 * **입력 경로가 둘이다**(I-1). 마우스는 HTML5 dragstart로 fixtureId만 실어 보내고,
 * 키보드는 Enter/Space로 배치 초안을 띄운다. 판정은 둘 다 `placeItem`을 거친다.
 *
 * 항목이 `<button>`인 것이 핵심이다 — 이전에는 `<div draggable>`이라 **탭 이동조차 되지 않아**
 * 키보드 사용자에게 집기 배치가 아예 불가능했다(Sprint 1 §5.1-2 이월).
 * `draggable`은 그대로 두어 마우스 경로는 바뀌지 않는다.
 *
 * id를 **타입 이름에 싣는** 이유는 `app/lib/builder/dragTransfer`에 있다(dragover에서는
 * 값을 읽을 수 없다).
 */

type FixturePanelProps = {
  fixtures: readonly Fixture[];
  isLoading: boolean;
};

export function FixturePanel({ fixtures, isLoading }: FixturePanelProps) {
  const [category, setCategory] = useState<FixtureCategory | "ALL">("ALL");
  const draft = useBuilderStore((state) => state.draft);
  const startDraft = useBuilderStore((state) => state.startDraft);

  const visible = category === "ALL" ? fixtures : fixtures.filter((f) => f.category === category);

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4">
      <h2 className="text-heading">집기 라이브러리</h2>

      {/*
        조작 안내를 화면에 둔다. 키보드 경로는 발견 가능성이 낮아서, 적어두지 않으면
        "탭으로 갈 수는 있는데 그다음 뭘 눌러야 하는지" 알 길이 없다.
      */}
      <p className="text-caption text-text-muted">
        끌어다 놓거나, 항목을 고른 뒤 방향키로 옮기고 Enter로 배치합니다. (회전 R · 취소 Esc)
      </p>

      <div className="flex flex-wrap gap-2">
        <CategoryTab label="전체" active={category === "ALL"} onClick={() => setCategory("ALL")} />
        {CATEGORY_ORDER.map((value) => (
          <CategoryTab
            key={value}
            label={CATEGORY_LABELS[value]}
            active={category === value}
            onClick={() => setCategory(value)}
          />
        ))}
      </div>

      {isLoading ? (
        <p className="text-caption text-text-muted">집기 목록을 불러오는 중…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((fixture) => (
            <li key={fixture.id}>
              <button
                type="button"
                draggable
                aria-pressed={draft?.fixtureId === fixture.id}
                onDragStart={(event) => {
                  event.dataTransfer.setData(fixtureDragType(fixture.id), String(fixture.id));
                  event.dataTransfer.effectAllowed = "copy";
                }}
                // Space·Enter 모두 button의 기본 클릭으로 들어온다 — 따로 keydown을 달지 않는다.
                onClick={() => startDraft(fixture.id)}
                className={`w-full cursor-grab rounded-lg border p-3 text-left active:cursor-grabbing ${
                  draft?.fixtureId === fixture.id
                    ? "border-primary bg-primary-light"
                    : "border-border bg-surface"
                }`}
              >
                <p className="text-body-strong">{fixture.name}</p>
                <p className="mt-1 text-caption text-text-muted tabular-nums">
                  {fixture.widthMm}×{fixture.depthMm}mm · {fixture.powerWatt}W ·{" "}
                  {fixture.dailyRentalFee.toLocaleString("ko-KR")}원/일
                </p>
              </button>
            </li>
          ))}
          {visible.length === 0 ? (
            <li className="text-caption text-text-muted">이 카테고리에는 집기가 없습니다.</li>
          ) : null}
        </ul>
      )}
    </aside>
  );
}

function CategoryTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-caption ${
        active ? "bg-primary text-white" : "border border-border bg-surface text-text-muted"
      }`}
    >
      {label}
    </button>
  );
}
