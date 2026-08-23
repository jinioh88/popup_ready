import { Card } from "../../components/ui/Card";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { fixtureDragType } from "../../lib/builder/dragTransfer";
import type { FixtureAvailabilityState } from "../../lib/builder/availability";
import type { Fixture } from "../../lib/schemas/api";

/**
 * 집기 팔레트 카드 (스타일가이드 §8.A).
 *
 * 규격·소비전력·일 대여료를 배지로 보여주고, **두 입력 경로를 모두 받는다**(I-1) —
 * 마우스는 HTML5 드래그, 키보드는 Enter/Space로 배치 초안을 띄운다.
 *
 * `<button>`인 것이 핵심이다. 이전에는 `<div draggable>`이라 탭 이동조차 되지 않아 키보드
 * 사용자에게 배치가 아예 불가능했다. `draggable`을 그대로 둬서 마우스 경로는 바뀌지 않는다.
 *
 * **§8.A의 'W×D×H' 중 H는 표시하지 않는다** — 계약 `FixtureResponse`에 `heightMm`이 없다.
 * 없는 값을 자리만 잡아 두면 빈칸이 뜨거나 0이 뜬다. 필요하면 계약 변경이 선행돼야 한다.
 */

type ModularItemCardProps = {
  fixture: Fixture;
  /** 지금 이 집기를 키보드로 배치 중인가. */
  isDrafting: boolean;
  /**
   * 선택 기간의 가용 판정. 기간이 정해지기 전이거나 응답에 없으면 `undefined`이고,
   * 그때는 **막지 않는다** — 아직 모르는 것을 품절로 보여주면 고를 수 있는 집기를 못 고른다.
   */
  availability?: FixtureAvailabilityState;
  onActivate: (fixtureId: number) => void;
};

export function ModularItemCard({
  fixture,
  isDrafting,
  availability,
  onActivate,
}: ModularItemCardProps) {
  const soldOut = availability?.isSoldOut ?? false;

  return (
    <Card
      as="button"
      type="button"
      // 품절이면 드래그도 막는다 — 버튼만 비활성하고 draggable을 두면 마우스로는 여전히 놓인다.
      draggable={!soldOut}
      disabled={soldOut}
      // 색만으로 "지금 이걸 배치 중"을 전달하면 색을 못 보는 경로에서 사라진다.
      aria-pressed={isDrafting}
      onDragStart={(event: React.DragEvent<HTMLButtonElement>) => {
        event.dataTransfer.setData(fixtureDragType(fixture.id), String(fixture.id));
        event.dataTransfer.effectAllowed = "copy";
      }}
      // Space·Enter 모두 button의 기본 클릭으로 들어온다 — 따로 keydown을 달지 않는다.
      onClick={() => onActivate(fixture.id)}
      className={`w-full text-left ${
        soldOut
          ? "cursor-not-allowed opacity-60"
          : `cursor-grab active:cursor-grabbing ${isDrafting ? "border-primary bg-primary-light" : ""}`
      }`}
    >
      <p className="text-body-strong">{fixture.name}</p>

      <div className="mt-2 flex flex-wrap gap-1">
        <StatusBadge>
          {fixture.widthMm}×{fixture.depthMm}mm
        </StatusBadge>
        {/*
          전력은 한도(US-103)에 직접 걸리는 값이라 0W와 구분해서 보여준다.
          0W 집기를 "전력 0"으로 적으면 한도에 영향이 있는 것처럼 읽힌다.
        */}
        <StatusBadge tone={fixture.powerWatt > 0 ? "info" : "neutral"}>
          {fixture.powerWatt > 0 ? `${fixture.powerWatt.toLocaleString("ko-KR")}W` : "전원 불필요"}
        </StatusBadge>
        <StatusBadge>{fixture.dailyRentalFee.toLocaleString("ko-KR")}원/일</StatusBadge>
      </div>

      {/*
        가용 수량은 **색·투명도만으로 전달하지 않는다**(§8 인수 조건). 비활성 카드는 흐리게만
        보이면 "왜 못 고르는지"를 알 수 없으므로 사유와 남은 수를 글자로 적는다.
      */}
      {availability ? (
        <p className={`mt-2 text-caption ${soldOut ? "text-error" : "text-text-muted"}`}>
          {availability.isOverPlaced
            ? `이 기간에 ${availability.availableQty}개만 가능한데 ${availability.placedQty}개를 놓았습니다.`
            : soldOut
              ? "선택한 기간에 남은 수량이 없습니다."
              : `이 기간에 ${availability.remainingQty}개 더 배치할 수 있습니다.`}
        </p>
      ) : null}
    </Card>
  );
}
