import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DRAG_THROTTLE_MS, throttle } from "./throttle";

describe("throttle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("기본 대기 시간은 백로그 품질 게이트인 150ms다", () => {
    expect(DRAG_THROTTLE_MS).toBe(150);
  });

  it("첫 호출은 즉시 실행한다", () => {
    const fn = vi.fn();

    throttle(fn)(1);

    expect(fn).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("대기 구간 안의 연속 호출은 마지막 인자로 한 번만 흘려보낸다", () => {
    const fn = vi.fn();
    const throttled = throttle(fn);

    throttled(1);
    throttled(2);
    throttled(3);

    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(DRAG_THROTTLE_MS);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(3);
  });

  it("드래그가 끝난 뒤 최종값이 유실되지 않는다", () => {
    const fn = vi.fn();
    const throttled = throttle(fn);

    throttled("start");
    vi.advanceTimersByTime(50);
    throttled("end");

    vi.advanceTimersByTime(DRAG_THROTTLE_MS);

    expect(fn).toHaveBeenLastCalledWith("end");
  });

  it("대기 구간에 호출이 없었다면 추가 실행이 일어나지 않는다", () => {
    const fn = vi.fn();

    throttle(fn)(1);
    vi.advanceTimersByTime(DRAG_THROTTLE_MS * 5);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("대기 시간이 지난 뒤의 호출은 다시 즉시 실행된다", () => {
    const fn = vi.fn();
    const throttled = throttle(fn);

    throttled(1);
    vi.advanceTimersByTime(DRAG_THROTTLE_MS);
    throttled(2);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(2);
  });

  it("cancel은 대기 중인 트레일링 호출을 버린다", () => {
    const fn = vi.fn();
    const throttled = throttle(fn);

    throttled(1);
    throttled(2);
    throttled.cancel();

    vi.advanceTimersByTime(DRAG_THROTTLE_MS * 2);

    expect(fn).toHaveBeenCalledExactlyOnceWith(1);
  });
});
