import { createSlideGesture } from "../src/lib/doorlock/slide-gesture";

/**
 * 슬라이드 제스처 **수명주기** 회귀 테스트 (2026-08-23 실기기 결함).
 *
 * `doorlock-slide-test.ts`는 임계 비율을 직접 넣어 보는 순수 함수 테스트라 제스처
 * 파이프라인을 한 번도 지나지 않는다. 실기기에서 "빠르게 밀면 손잡이가 중간에 멈추고
 * 안 열린다"가 나온 자리는 판정식이 아니라 **응답자를 언제 잃는가**였다.
 */

const TRACK = 300;
const KNOB = 56;

function setup(canSlide = true) {
  const moveKnob = jest.fn();
  const settleKnob = jest.fn();
  const onCommit = jest.fn();
  const gesture = createSlideGesture({
    canSlide,
    trackWidth: TRACK,
    knobWidth: KNOB,
    moveKnob,
    settleKnob,
    onCommit,
  });
  return { gesture, moveKnob, settleKnob, onCommit };
}

describe("슬라이드 제스처 정책", () => {
  it("응답자를 부모(ScrollView)에게 넘기지 않는다", () => {
    const { gesture } = setup();
    // 기본값은 true다(RN PanResponder). true면 제스처 도중 스크롤이 가져가고
    // release가 오지 않아 손잡이가 얼어붙은 채 조용히 실패한다 — 실기기 결함의 원인.
    expect(gesture.onPanResponderTerminationRequest()).toBe(false);
  });

  it("그래도 뺏기면 문을 열지 않되 손잡이는 되돌린다", () => {
    const { gesture, settleKnob, onCommit } = setup();

    gesture.onPanResponderMove(null, { dx: 280 });
    gesture.onPanResponderTerminate();

    // 되돌리지 않으면 손잡이가 중간에 멈춘 채 남는다 — 사용자가 본 그 화면이다.
    expect(settleKnob).toHaveBeenCalledWith(false);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("빠른 손짓 — 중간 move가 하나도 안 와도 놓는 순간의 dx로 판정한다", () => {
    const { gesture, moveKnob, settleKnob, onCommit } = setup();

    // 표시는 한 번도 갱신되지 않았다(손잡이는 시작 위치에 있다).
    gesture.onPanResponderRelease(null, { dx: TRACK });

    expect(moveKnob).not.toHaveBeenCalled();
    expect(settleKnob).toHaveBeenCalledWith(true);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("표시가 뒤처져 손잡이가 중간에 있어도 dx가 임계를 넘었으면 연다", () => {
    const { gesture, settleKnob, onCommit } = setup();

    // 손잡이는 트랙 절반까지만 따라왔는데(마지막 move가 dx=150) 손가락은 끝까지 갔다.
    gesture.onPanResponderMove(null, { dx: 150 });
    gesture.onPanResponderRelease(null, { dx: TRACK });

    expect(settleKnob).toHaveBeenCalledWith(true);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("임계 미만으로 놓으면 열지 않고 되돌린다 — 짝이 되는 대조", () => {
    const { gesture, settleKnob, onCommit } = setup();

    gesture.onPanResponderRelease(null, { dx: TRACK * 0.69 });

    expect(settleKnob).toHaveBeenCalledWith(false);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("손잡이는 트랙 밖으로 나가지 않는다", () => {
    const { gesture, moveKnob } = setup();

    gesture.onPanResponderMove(null, { dx: 9999 });

    expect(moveKnob).toHaveBeenCalledWith(TRACK - KNOB);
  });

  it("밀 수 없는 상태에서는 응답자를 잡지 않는다", () => {
    const { gesture } = setup(false);

    expect(gesture.onStartShouldSetPanResponder()).toBe(false);
    expect(gesture.onMoveShouldSetPanResponder()).toBe(false);
  });
});
