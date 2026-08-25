// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";

import { useRotationShortcut } from "./useRotationShortcut";
import { useBuilderStore } from "../../stores/builder";
import type { FixtureCatalog } from "./queries";

/**
 * **이 훅에는 테스트가 하나도 없었다**(§8.14). `6cf916f`가 여기서 중복 바인딩 버그를
 * 고쳤는데도 테스트가 생기지 않아, 그 수정을 지키는 것이 주석 한 줄뿐이었다 —
 * `if (draft) return;` 세 줄을 지워도 아무것도 깨지지 않는 상태였다.
 *
 * 아래 ②가 그 수정이다.
 */

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
  renderHook(() => useRotationShortcut(CATALOG, onRejected));
  return onRejected;
}

/** 실제 브라우저처럼 `key`와 `code`를 함께 보낸다. */
function pressR(key: string, target: EventTarget = window, code = "KeyR") {
  const event = new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

/** 집기 하나를 놓고 선택된 상태로 만든다(`placeItem`이 배치 직후 선택을 남긴다). */
function placeOne(col = 0, row = 0) {
  store().placeItem({ fixtureId: 1, col, row, rotation: 0 }, CATALOG);
}

describe("useRotationShortcut — 회전", () => {
  it("선택된 집기를 R로 돌린다", () => {
    mount();
    placeOne();

    expect(pressR("r").defaultPrevented).toBe(true);
    expect(store().items[0]?.rotation).toBe(90);
  });

  it("한글 입력 상태에서도 돌아간다", () => {
    // ① 결함 7. key는 입력기를 통과한 결과라 'ㄱ'이 오고, code만이 물리 키를 말한다.
    mount();
    placeOne();

    pressR("ㄱ");

    expect(store().items[0]?.rotation).toBe(90);
  });

  it("선택된 집기가 없으면 아무 일도 없다", () => {
    mount();

    expect(pressR("r").defaultPrevented).toBe(false);
  });
});

describe("useRotationShortcut — 물러나야 하는 자리", () => {
  it("키보드 배치 초안이 떠 있으면 물러난다", () => {
    /*
     * ② `6cf916f`가 고친 그것. 초안이 있을 때 R은 **초안의 것**이다(`useKeyboardPlacement`).
     * 여기서도 처리하면 한 번의 R이 초안과 선택된 집기를 **함께** 돌린다.
     *
     * 그리고 이건 드문 조합이 아니라 **기본 경로**다 — `placeItem`이 배치 직후 선택을 남기므로,
     * 집기 하나 놓고 다음 걸 배치하려는 순간이 바로 이 상태다.
     */
    mount();
    placeOne();
    store().startDraft(1);

    pressR("r");

    expect(store().items[0]?.rotation).toBe(0);
  });

  it("입력 요소에 포커스가 있으면 물러난다", () => {
    // ③ 예약 기간 입력이 같은 화면에 있다. 폼에 'r'을 타이핑하는 것과 구분해야 한다.
    mount();
    placeOne();

    const input = document.createElement("input");
    document.body.appendChild(input);
    pressR("r", input);
    input.remove();

    expect(store().items[0]?.rotation).toBe(0);
  });

  it("수정자 키 조합은 가로채지 않는다", () => {
    mount();
    placeOne();

    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "r", code: "KeyR", metaKey: true, bubbles: true }),
    );

    expect(store().items[0]?.rotation).toBe(0);
  });
});

describe("useRotationShortcut — 거절", () => {
  it("회전이 거절되면 사유를 알린다", () => {
    /*
     * ④ 이 훅의 실패 경로 전체가 미검증이었다. 회전은 점유 셀이 스왑되는 동작이라
     * **충돌 거절이 예외가 아니라 정상 분기**다 — 가로로 긴 집기를 세우면 아래로 자란다.
     */
    const onRejected = mount();
    // 10×10 그리드의 맨 아래 줄. 1000×500mm(2×1칸)을 90도 돌리면 1×2칸이 되어 밖으로 나간다.
    placeOne(0, 9);

    pressR("r");

    expect(onRejected).toHaveBeenCalledWith("회전하면 도면 범위를 벗어납니다.");
    expect(store().items[0]?.rotation).toBe(0);
  });
});
