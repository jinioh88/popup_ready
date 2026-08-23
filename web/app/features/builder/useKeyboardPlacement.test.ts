// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";

import { useKeyboardPlacement } from "./useKeyboardPlacement";
import { useBuilderStore } from "../../stores/builder";
import type { FixtureCatalog } from "./queries";

const CATALOG: FixtureCatalog = {
  1: {
    id: 1,
    name: "행거 랙",
    category: "HANGER",
    widthMm: 1000,
    depthMm: 500,
    powerWatt: 0,
    dailyRentalFee: 0,
    stockQty: 5,
  },
};

const store = () => useBuilderStore.getState();

beforeEach(() => {
  store().reset();
  store().initGrid(1, { gridCols: 10, gridRows: 10, cellSizeMm: 500 });
});

afterEach(cleanup);

function mount() {
  const onRejected = vi.fn();
  renderHook(() => useKeyboardPlacement(CATALOG, onRejected));
  return onRejected;
}

/** 창에 키를 보내고 기본 동작이 막혔는지 함께 돌려준다. */
function press(key: string, target: EventTarget = window) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

describe("useKeyboardPlacement — 초안이 없을 때", () => {
  it("아무 키도 가로채지 않는다", () => {
    mount();

    // 초안이 없으면 방향키는 페이지 스크롤이어야 한다.
    expect(press("ArrowRight").defaultPrevented).toBe(false);
    expect(press("Enter").defaultPrevented).toBe(false);
  });
});

describe("useKeyboardPlacement — 조작", () => {
  it("방향키로 옮기고 페이지 스크롤은 막는다", () => {
    mount();
    store().startDraft(1);

    expect(press("ArrowRight").defaultPrevented).toBe(true);
    press("ArrowDown");

    expect(store().draft).toMatchObject({ col: 1, row: 1 });
  });

  it("R로 회전한다", () => {
    mount();
    store().startDraft(1);

    press("r");

    expect(store().draft).toMatchObject({ rotation: 90 });
  });

  it("Enter로 확정한다", () => {
    mount();
    store().startDraft(1);
    store().moveDraft(2, 2);

    press("Enter");

    expect(store().draft).toBeNull();
    expect(store().items).toEqual([{ fixtureId: 1, col: 2, row: 2, rotation: 0 }]);
  });

  it("Enter의 기본 동작을 막는다 — 안 막으면 포커스된 팔레트 버튼이 다시 눌린다", () => {
    // 키보드로 배치하면 포커스는 팔레트 버튼에 남아 있다. Enter는 그 버튼의 click을
    // 기본 동작으로 발생시키므로, preventDefault를 놓치면 **확정 직후 초안이 다시 뜬다.**
    mount();
    store().startDraft(1);

    expect(press("Enter").defaultPrevented).toBe(true);
  });

  it("Esc로 취소한다", () => {
    mount();
    store().startDraft(1);

    press("Escape");

    expect(store().draft).toBeNull();
    expect(store().items).toHaveLength(0);
  });

  it("확정이 거부되면 사유를 올리고 초안은 남는다", () => {
    store().placeItem({ fixtureId: 1, col: 0, row: 0, rotation: 0 }, CATALOG);
    const onRejected = mount();
    store().startDraft(1);

    press("Enter");

    expect(onRejected).toHaveBeenCalledWith("다른 집기와 겹쳐 배치할 수 없습니다.");
    expect(store().draft).not.toBeNull();
  });
});

describe("useKeyboardPlacement — 다른 입력과의 경합", () => {
  it("폼 입력 중에는 방향키를 가로채지 않는다", () => {
    // 예약 기간 입력이 같은 화면에 있다 — 방향키는 커서 이동이어야 한다.
    mount();
    store().startDraft(1);

    const input = document.createElement("input");
    document.body.appendChild(input);

    expect(press("ArrowRight", input).defaultPrevented).toBe(false);
    expect(store().draft).toMatchObject({ col: 0 });

    input.remove();
  });

  it("수정자 키 조합은 브라우저·OS 단축키다", () => {
    mount();
    store().startDraft(1);

    const event = new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(store().draft).toMatchObject({ col: 0 });
  });
});
