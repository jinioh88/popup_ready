import { Button } from "../../components/ui/Button";
import { useBuilderStore } from "../../stores/builder";
import { rotationRejectionMessage } from "./messages";
import type { FixtureCatalog } from "./queries";

/**
 * 캔버스 조작 바 (스타일가이드 §8.A) — 선택된 집기의 조작 · 핫키 안내 · 거부 경고를 모은다.
 *
 * Sprint 1에는 선택 조작(`SelectionToolbar`)과 거부 문구가 라우트에서 나란히 렌더되고 있었다.
 * 같은 줄에 붙어 같은 맥락을 말하면서 소유자가 둘이면, 한쪽만 옮겨지거나 한쪽만 조건이 바뀐다.
 *
 * **§8.A의 '그리드 스냅 토글'은 만들지 않는다.** 이 빌더에서 스냅은 끌 수 있는 옵션이 아니다 —
 * 레이아웃 JSON이 **셀 좌표**로 정의돼 있고(sprint1.md §2.3) 백엔드 재검증도 셀 기준이라,
 * 자유 픽셀 배치는 저장할 표현 자체가 없다. 토글을 두면 끌 수 없는 스위치가 된다.
 * 스코프가 바뀌면 계약(레이아웃 스키마) 변경이 선행돼야 한다 — PM 보고 대상이다.
 */

type CanvasControllerProps = {
  fixtures: FixtureCatalog;
  onRejected: (message: string) => void;
  /** 방금 거부된 배치·회전의 사유. 없으면 표시하지 않는다. */
  rejection: string | null;
  /**
   * 선택 기간의 가용 수량을 넘겨 놓은 집기 이름들 (I-3).
   *
   * 거부 문구와 **수명이 다르다** — 거부는 다음 조작으로 해소되지만 이건 사용자가 집기를
   * 뺄 때까지 계속 참이다. 그래서 자동으로 사라지지 않는다.
   */
  overPlacedNames: readonly string[];
};

export function CanvasController({
  fixtures,
  onRejected,
  rejection,
  overPlacedNames,
}: CanvasControllerProps) {
  const selectedIndex = useBuilderStore((state) => state.selectedIndex);
  const items = useBuilderStore((state) => state.items);
  const draft = useBuilderStore((state) => state.draft);
  const rotateItem = useBuilderStore((state) => state.rotateItem);
  const removeItem = useBuilderStore((state) => state.removeItem);

  const selected = selectedIndex === null ? undefined : items[selectedIndex];
  const fixture = selected ? fixtures[selected.fixtureId] : undefined;

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-3">
      {draft ? (
        // 배치 중에는 R·Enter·Esc가 초안의 것이다 — 선택된 집기 조작과 헷갈리지 않게 안내를 바꾼다.
        <p className="text-caption text-text-muted">
          배치 위치를 방향키로 옮기고 Enter로 놓습니다. (회전 R · 취소 Esc)
        </p>
      ) : selectedIndex !== null && selected && fixture ? (
        <>
          <p className="text-caption text-text-muted">
            선택: <span className="text-text">{fixture.name}</span> ·{" "}
            <span className="tabular-nums">{selected.rotation}°</span>
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              const result = rotateItem(selectedIndex, fixtures);

              if (!result.ok) {
                onRejected(rotationRejectionMessage(result.reason));
              }
            }}
          >
            90° 회전 (R)
          </Button>
          <Button variant="destructive" onClick={() => removeItem(selectedIndex)}>
            삭제
          </Button>
        </>
      ) : (
        <p className="text-caption text-text-muted">
          집기를 캔버스로 끌어다 놓거나 팔레트에서 Enter로 배치합니다. 배치된 집기를 선택하면
          회전·삭제할 수 있습니다. (회전 단축키: R)
        </p>
      )}

      {/* 거부 사유. 캔버스가 Konva라 시각 피드백만으로는 스크린리더에 아무것도 남지 않는다. */}
      {rejection ? (
        <p role="alert" className="text-caption text-error">
          {rejection}
        </p>
      ) : null}

      {/*
        기간을 바꿔 이미 놓은 집기가 가용을 넘긴 경우. **캔버스에서 조용히 빼지 않는다** —
        도면이 왜 바뀌었는지 알 수 없게 된다. 무엇을 빼야 하는지 이름으로 짚어 준다.
        이 상태로 제출하면 서버가 409 FIXTURE_UNAVAILABLE로 막는다.
      */}
      {overPlacedNames.length > 0 ? (
        <p role="alert" className="w-full text-caption text-error">
          선택한 기간에 수량이 부족한 집기가 있습니다: {overPlacedNames.join(", ")}. 해당 집기를
          빼거나 기간을 바꿔 주세요.
        </p>
      ) : null}
    </div>
  );
}
