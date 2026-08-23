import { useState } from "react";

import type { AvailabilityMap } from "../../lib/builder/availability";
import type { Fixture, FixtureCategory } from "../../lib/schemas/api";
import { useBuilderStore } from "../../stores/builder";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "./constants";
import { ModularItemCard } from "./ModularItemCard";

/**
 * 집기 라이브러리 패널 — 카테고리 필터 + 항목 목록.
 *
 * **이 컴포넌트는 목록과 필터만 맡는다.** 항목 하나의 표현과 두 입력 경로(드래그·키보드)는
 * `ModularItemCard`가 갖는다 — 팔레트가 커질수록 필터 로직과 항목 렌더가 한 파일에서 엉킨다.
 */

type FixturePanelProps = {
  fixtures: readonly Fixture[];
  isLoading: boolean;
  /** 선택 기간의 집기별 가용 판정. 기간 전에는 빈 맵이고 아무것도 잠기지 않는다. */
  availability: AvailabilityMap;
};

export function FixturePanel({ fixtures, isLoading, availability }: FixturePanelProps) {
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
              <ModularItemCard
                fixture={fixture}
                isDrafting={draft?.fixtureId === fixture.id}
                availability={availability[fixture.id]}
                onActivate={startDraft}
              />
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
