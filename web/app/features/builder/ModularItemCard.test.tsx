// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ModularItemCard } from "./ModularItemCard";
import type { FixtureAvailabilityState } from "../../lib/builder/availability";
import type { Fixture } from "../../lib/schemas/api";

const FIXTURE: Fixture = {
  id: 1,
  name: "행거 랙",
  category: "HANGER",
  widthMm: 1000,
  depthMm: 500,
  powerWatt: 0,
  dailyRentalFee: 12_000,
  stockQty: 5,
};

const AVAILABLE: FixtureAvailabilityState = {
  availableQty: 3,
  placedQty: 1,
  remainingQty: 2,
  isSoldOut: false,
  isOverPlaced: false,
};

const SOLD_OUT: FixtureAvailabilityState = {
  availableQty: 2,
  placedQty: 2,
  remainingQty: 0,
  isSoldOut: true,
  isOverPlaced: false,
};

const OVER_PLACED: FixtureAvailabilityState = {
  availableQty: 2,
  placedQty: 3,
  remainingQty: 0,
  isSoldOut: true,
  isOverPlaced: true,
};

afterEach(cleanup);

function renderCard(availability?: FixtureAvailabilityState) {
  const onActivate = vi.fn();
  render(
    <ModularItemCard
      fixture={FIXTURE}
      isDrafting={false}
      availability={availability}
      onActivate={onActivate}
    />,
  );
  return { onActivate, card: screen.getByRole("button", { name: /행거 랙/ }) };
}

describe("ModularItemCard — 가용 수량을 모를 때", () => {
  it("막지 않는다", () => {
    // 기간 선택 전이다. 아직 모르는 것을 품절로 보여주면 고를 수 있는 집기를 못 고른다.
    const { onActivate, card } = renderCard(undefined);

    fireEvent.click(card);

    expect(card.hasAttribute("disabled")).toBe(false);
    expect(onActivate).toHaveBeenCalledWith(1);
  });
});

describe("ModularItemCard — 품절", () => {
  it("두 입력 경로를 모두 막는다", () => {
    // 버튼만 비활성하고 draggable을 두면 마우스로는 여전히 놓인다.
    const { onActivate, card } = renderCard(SOLD_OUT);

    fireEvent.click(card);

    expect(card.hasAttribute("disabled")).toBe(true);
    expect(card.getAttribute("draggable")).toBe("false");
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("사유를 글자로 적는다 — 흐리게만 보이면 왜 못 고르는지 알 수 없다", () => {
    renderCard(SOLD_OUT);

    expect(screen.getByText("선택한 기간에 남은 수량이 없습니다.")).toBeTruthy();
  });
});

describe("ModularItemCard — 남은 수량", () => {
  it("더 놓을 수 있으면 남은 수를 알린다", () => {
    renderCard(AVAILABLE);

    expect(screen.getByText(/2개 더 배치할 수 있습니다/)).toBeTruthy();
  });

  it("초과 배치는 놓은 수와 가능한 수를 함께 보여준다", () => {
    // "품절"만 말하면 이미 놓아둔 것을 빼야 한다는 걸 알 수 없다.
    renderCard(OVER_PLACED);

    const text = screen.getByText(/2개만 가능한데 3개를 놓았습니다/);

    expect(text).toBeTruthy();
  });
});

describe("ModularItemCard — 규격 표시", () => {
  it("전력이 0이면 숫자 대신 전원 불필요로 적는다", () => {
    // 0W를 숫자로 적으면 전력 한도(US-103)에 영향이 있는 것처럼 읽힌다.
    renderCard();

    expect(screen.getByText("전원 불필요")).toBeTruthy();
  });
});
