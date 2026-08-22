import { useState } from "react";

import type { Fixture, FixtureCategory } from "../../lib/schemas/api";
import { CATEGORY_LABELS, CATEGORY_ORDER, FIXTURE_DRAG_TYPE } from "./constants";

/**
 * 집기 라이브러리 패널 — 카테고리 탭 + 캔버스로 끌어다 놓는 항목 목록.
 *
 * 드래그는 HTML5 dragstart로 fixtureId만 실어 보낸다. 좌표 환산·충돌 판정은 캔버스가 한다.
 */

type FixturePanelProps = {
  fixtures: readonly Fixture[];
  isLoading: boolean;
};

export function FixturePanel({ fixtures, isLoading }: FixturePanelProps) {
  const [category, setCategory] = useState<FixtureCategory | "ALL">("ALL");

  const visible = category === "ALL" ? fixtures : fixtures.filter((f) => f.category === category);

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4">
      <h2 className="text-heading">집기 라이브러리</h2>

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
              <div
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(FIXTURE_DRAG_TYPE, String(fixture.id));
                  event.dataTransfer.effectAllowed = "copy";
                }}
                className="cursor-grab rounded-lg border border-border bg-surface p-3 active:cursor-grabbing"
              >
                <p className="text-body-strong">{fixture.name}</p>
                <p className="mt-1 text-caption text-text-muted">
                  {fixture.widthMm}×{fixture.depthMm}mm · {fixture.powerWatt}W ·{" "}
                  {fixture.dailyRentalFee.toLocaleString("ko-KR")}원/일
                </p>
              </div>
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
