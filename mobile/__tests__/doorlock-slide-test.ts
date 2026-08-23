import {
  isSlideCommitted,
  slideOffset,
  slideProgress,
  SLIDE_THRESHOLD_RATIO,
} from "../src/lib/doorlock/slide";

const TRACK = 300;
const KNOB = 56;

describe("슬라이드 개방 판정", () => {
  it("밀린 거리를 0~1 진행률로 바꾼다", () => {
    expect(slideProgress(0, TRACK)).toBe(0);
    expect(slideProgress(150, TRACK)).toBe(0.5);
    expect(slideProgress(300, TRACK)).toBe(1);
  });

  it("트랙 밖으로 나가도 구간 안으로 접는다", () => {
    expect(slideProgress(-80, TRACK)).toBe(0);
    expect(slideProgress(900, TRACK)).toBe(1);
  });

  it("임계 미만이면 발동하지 않는다", () => {
    // 끝까지 밀지 않은 손짓으로 문이 열리면 안 된다 — 그게 버튼을 안 쓰는 이유다.
    expect(isSlideCommitted(TRACK * SLIDE_THRESHOLD_RATIO - 1, TRACK)).toBe(false);
    expect(isSlideCommitted(0, TRACK)).toBe(false);
  });

  it("임계에 정확히 닿으면 발동한다", () => {
    expect(isSlideCommitted(TRACK * SLIDE_THRESHOLD_RATIO, TRACK)).toBe(true);
    expect(isSlideCommitted(TRACK, TRACK)).toBe(true);
  });

  it("레이아웃 전(너비 0)에는 발동하지 않는다", () => {
    // onLayout 전에 손이 닿는 순간 0으로 나누면 NaN이 되고, 비교가 조용히 참이 될 수 있다.
    expect(slideProgress(50, 0)).toBe(0);
    expect(isSlideCommitted(50, 0)).toBe(false);
  });

  it("손잡이가 트랙 밖으로 튀어나가지 않는다", () => {
    expect(slideOffset(-40, TRACK, KNOB)).toBe(0);
    expect(slideOffset(120, TRACK, KNOB)).toBe(120);
    expect(slideOffset(9_999, TRACK, KNOB)).toBe(TRACK - KNOB);
  });
});
