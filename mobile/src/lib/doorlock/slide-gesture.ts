import { isSlideCommitted, slideOffset } from "./slide";

/**
 * 슬라이드 제스처의 **정책**만 담는다 — 애니메이션·React 무의존(src/lib 규칙).
 *
 * `PanResponder.create()`에 그대로 넘길 config를 만든다. 이렇게 떼어 두는 이유는
 * 실기기에서만 드러난 결함이 **판정식이 아니라 제스처 수명주기**에 있었기 때문이다.
 * `SLIDE_THRESHOLD_RATIO`를 직접 넣어 보는 테스트는 그 구간을 한 번도 지나지 않는다.
 *
 * **2026-08-23 실기기 결함**: 빠르게 밀면 손잡이가 트랙 중간에 멈춘 채 개방되지 않았다.
 * 원인은 `onPanResponderTerminationRequest`의 **기본값이 `true`**라는 것이다(RN
 * `PanResponder.js:550-554`) — 부모 `ScrollView`가 제스처 도중 응답자를 요구하면 그대로
 * 넘겨 준다. 넘기는 순간 `onPanResponderRelease`는 **영영 오지 않는다.** 그래서
 * ① 손잡이가 마지막 위치에 얼어붙고 ② 그 시도는 아무 문구 없이 실패한다.
 * 빠른 손짓일수록 세로 성분이 커져 스크롤이 반응하므로 "빠를 때만" 나는 것도 설명된다.
 */
export type SlideGestureOptions = {
  /** 지금 밀 수 있는가(연결 상태·진행 중 여부). 거짓이면 응답자를 잡지 않는다. */
  canSlide: boolean;
  trackWidth: number;
  knobWidth: number;
  /** 표시 갱신 — 손잡이를 px 위치로 옮긴다. */
  moveKnob: (offset: number) => void;
  /** 제스처 종료 — 개방 위치(true) 또는 시작 위치(false)로 되돌린다. */
  settleKnob: (committed: boolean) => void;
  /** 개방 발동. */
  onCommit: () => void;
};

type Gesture = { dx: number };

export type SlideGestureConfig = {
  onStartShouldSetPanResponder: () => boolean;
  onMoveShouldSetPanResponder: () => boolean;
  onPanResponderTerminationRequest: () => boolean;
  onPanResponderMove: (event: unknown, gesture: Gesture) => void;
  onPanResponderRelease: (event: unknown, gesture: Gesture) => void;
  onPanResponderTerminate: () => void;
};

export function createSlideGesture({
  canSlide,
  trackWidth,
  knobWidth,
  moveKnob,
  settleKnob,
  onCommit,
}: SlideGestureOptions): SlideGestureConfig {
  return {
    onStartShouldSetPanResponder: () => canSlide,
    onMoveShouldSetPanResponder: () => canSlide,

    // **응답자를 남에게 넘기지 않는다.** 기본값(true)이면 부모 ScrollView가 제스처를
    // 가져가고 release가 오지 않는다 — 위 주석의 실기기 결함이 정확히 이것이다.
    onPanResponderTerminationRequest: () => false,

    onPanResponderMove: (_event, gesture) => {
      moveKnob(slideOffset(gesture.dx, trackWidth, knobWidth));
    },

    // **판정은 손가락이 실제로 간 거리(dx)로 한다.** 표시가 뒤처져 손잡이가 중간에
    // 있어도, 놓는 순간의 dx가 임계를 넘었으면 연다.
    onPanResponderRelease: (_event, gesture) => {
      const committed = isSlideCommitted(gesture.dx, trackWidth);
      settleKnob(committed);
      if (committed) onCommit();
    },

    // 그래도 뺏겼을 때(전화 수신 등 시스템 제스처): 열지 않되 **손잡이는 반드시 되돌린다.**
    // 되돌리지 않으면 얼어붙은 손잡이가 "밀었는데 안 열렸다"로 남는다.
    onPanResponderTerminate: () => {
      settleKnob(false);
    },
  };
}
