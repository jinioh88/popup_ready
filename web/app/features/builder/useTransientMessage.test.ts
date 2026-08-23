// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useTransientMessage } from "./useTransientMessage";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useTransientMessage", () => {
  it("처음에는 아무 문구도 없다", () => {
    const { result } = renderHook(() => useTransientMessage());

    expect(result.current.message).toBeNull();
  });

  it("띄운 문구가 시간이 지나면 사라진다", () => {
    const { result } = renderHook(() => useTransientMessage(2500));

    act(() => result.current.show("다른 집기와 겹쳐 배치할 수 없습니다."));
    expect(result.current.message).toBe("다른 집기와 겹쳐 배치할 수 없습니다.");

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(result.current.message).toBeNull();
  });

  it("같은 문구가 다시 오면 타이머가 처음부터 다시 간다", () => {
    // 같은 자리에 연달아 놓으려 하면 같은 사유가 반복된다. 문구만 비교하면 상태가 안 바뀌어
    // 타이머가 갱신되지 않고, 마지막 거부의 안내가 곧바로 사라진다.
    const { result } = renderHook(() => useTransientMessage(2500));

    act(() => result.current.show("겹칩니다."));

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => result.current.show("겹칩니다."));

    // 첫 타이머 기준이면 여기서 사라졌어야 한다.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.message).toBe("겹칩니다.");

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.message).toBeNull();
  });

  it("언마운트 뒤에는 타이머가 남지 않는다", () => {
    const { result, unmount } = renderHook(() => useTransientMessage());

    act(() => result.current.show("겹칩니다."));
    unmount();

    expect(() =>
      act(() => {
        vi.advanceTimersByTime(5000);
      }),
    ).not.toThrow();
  });
});
