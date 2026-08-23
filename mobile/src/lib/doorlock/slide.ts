/**
 * 슬라이드 개방 판정 (스타일가이드 §8.C — 원터치 슬라이드, 오작동 방지).
 *
 * 오탈자 한 번에 문이 열리는 버튼은 쓰지 않는다. 순수 함수로 떼어 두어 임계값을 눈이 아니라
 * 테스트로 고정한다. React·Expo 무의존(src/lib 규칙).
 */

/** 트랙의 이 비율만큼 밀어야 발동한다. 짧으면 오작동하고, 길면 한 손으로 못 민다. */
export const SLIDE_THRESHOLD_RATIO = 0.7;

/** 밀린 거리 → 0~1 진행률. 트랙 밖으로 나가도 구간 안으로 접는다. */
export function slideProgress(dx: number, trackWidth: number): number {
  if (trackWidth <= 0) return 0;
  return clamp(dx / trackWidth, 0, 1);
}

/** 발동 여부. 임계 비율 이상 밀렸을 때만 참이다. */
export function isSlideCommitted(dx: number, trackWidth: number): boolean {
  return slideProgress(dx, trackWidth) >= SLIDE_THRESHOLD_RATIO;
}

/**
 * 손잡이의 실제 x 위치(px).
 *
 * 손잡이 너비를 빼지 않으면 끝까지 밀었을 때 트랙 밖으로 튀어나간다.
 */
export function slideOffset(dx: number, trackWidth: number, knobWidth: number): number {
  const travel = Math.max(0, trackWidth - knobWidth);
  return clamp(dx, 0, travel);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
