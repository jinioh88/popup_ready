// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useLoadSummary } from "./useLoadSummary";
import { DRAG_THROTTLE_MS } from "../../lib/throttle";
import type { FixtureLookup } from "../../lib/builder/types";
import type { GridSpec, LayoutItem } from "../../lib/schemas/layout";

const GRID: GridSpec = { gridCols: 10, gridRows: 10, cellSizeMm: 500 };

const FIXTURES: FixtureLookup = {
  1: { id: 1, widthMm: 500, depthMm: 500, powerWatt: 100, dailyRentalFee: 0 },
};

/**
 * 집기 수 → 배치 배열. **같은 수면 같은 배열을 돌려준다.**
 *
 * 실제 호출부에서 `items`는 Zustand 스토어가 소유하고 배치가 바뀔 때만 새 배열이 된다.
 * 테스트에서 렌더마다 새 배열을 만들면 훅이 매 렌더 재계산을 예약해, 스로틀이 대기 구간을
 * 계속 이어붙이며 값이 한 박자씩 밀린다 — 실사용에 없는 조건으로 훅을 시험하는 셈이다.
 */
const ITEMS_BY_COUNT = new Map<number, LayoutItem[]>();

function items(count: number): LayoutItem[] {
  const cached = ITEMS_BY_COUNT.get(count);

  if (cached) {
    return cached;
  }

  const created = Array.from({ length: count }, () => ({
    fixtureId: 1,
    col: 0,
    row: 0,
    rotation: 0 as const,
  }));
  ITEMS_BY_COUNT.set(count, created);

  return created;
}

/** 집기 수만 바꿔가며 훅을 렌더한다. 100W짜리 집기이므로 `count × 100W`가 기대값이다. */
function renderCount(initialCount: number, maxPowerWatt = 10_000) {
  return renderHook(
    (props: { count: number }) =>
      useLoadSummary({
        items: items(props.count),
        fixtures: FIXTURES,
        grid: GRID,
        maxPowerWatt,
      }),
    { initialProps: { count: initialCount } },
  );
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useLoadSummary — 150ms 스로틀 게이트", () => {
  it("첫 값은 렌더 시점에 이미 계산돼 있다", () => {
    const { result } = renderCount(3);

    expect(result.current.power.watt).toBe(300);
  });

  it("띄엄띄엄 일어나는 변경은 지연 없이 반영된다", () => {
    // 드롭·드래그 종료가 이 경로다. 선두 즉시 실행이라 스로틀이 지연을 만들지 않는다.
    const { result, rerender } = renderCount(1);

    expect(result.current.power.watt).toBe(100);

    // 대기 구간이 끝난 뒤의 변경 — 곧바로 보여야 한다.
    act(() => {
      vi.advanceTimersByTime(DRAG_THROTTLE_MS);
    });
    act(() => rerender({ count: 5 }));

    expect(result.current.power.watt).toBe(500);
  });

  it("연속 변경은 묶이고 마지막 값이 살아남는다", () => {
    const { result, rerender } = renderCount(1);

    // 대기 구간 안에서 쏟아지는 변경 — 중간값은 건너뛴다.
    act(() => rerender({ count: 2 }));
    act(() => rerender({ count: 3 }));
    act(() => rerender({ count: 9 }));

    expect(result.current.power.watt).toBe(100);

    // 구간이 끝나면 **마지막** 값으로 맺는다. 최종값이 유실되면 안 된다.
    act(() => {
      vi.advanceTimersByTime(DRAG_THROTTLE_MS);
    });

    expect(result.current.power.watt).toBe(900);
  });

  it("연속된 이산 변경이 누적 지연 없이 따라온다", () => {
    // 드롭을 여러 번 하는 실제 조작이다. 한 번이라도 밀리면 그 뒤로 계속 밀린다.
    const { result, rerender } = renderCount(1);

    for (const count of [2, 3, 4]) {
      act(() => {
        vi.advanceTimersByTime(DRAG_THROTTLE_MS);
      });
      act(() => rerender({ count }));

      expect(result.current.power.watt).toBe(count * 100);
    }
  });

  it("값이 그대로면 상태 객체를 갈아치우지 않는다", () => {
    // summarizeLoad는 매번 새 객체를 돌려준다. 그대로 넣으면 값이 같아도 LimitGauge가
    // 다시 렌더된다 — 집기를 같은 전력·면적으로 옮기기만 해도 그렇다.
    const { result, rerender } = renderCount(2);
    const first = result.current;

    act(() => {
      vi.advanceTimersByTime(DRAG_THROTTLE_MS);
    });
    act(() => rerender({ count: 2 }));

    expect(result.current).toBe(first);
  });

  it("언마운트 뒤에는 대기 중이던 계산이 실행되지 않는다", () => {
    const { rerender, unmount } = renderCount(1);

    act(() => rerender({ count: 4 }));
    unmount();

    // 정리하지 않으면 언마운트된 컴포넌트에 setState가 걸린다.
    expect(() =>
      act(() => {
        vi.advanceTimersByTime(DRAG_THROTTLE_MS * 2);
      }),
    ).not.toThrow();
  });
});
