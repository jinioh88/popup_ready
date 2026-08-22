/**
 * 스로틀 유틸 — 드래그 중 파생 연산의 호출 빈도를 제한한다.
 *
 * 백로그 품질 게이트가 요구하는 **150ms**가 기본값이다. Sprint 2 US-103의
 * 전력·면적 실시간 합산이 이 유틸 위에 얹힌다.
 *
 * 선두 호출은 즉시 실행하고(첫 반응이 늦으면 드래그가 끊겨 보인다), 대기 구간에 들어온
 * 마지막 호출은 구간이 끝날 때 한 번 실행한다(드롭 직후 최종값이 유실되면 안 된다).
 */

export const DRAG_THROTTLE_MS = 150;

export type Throttled<Args extends unknown[]> = ((...args: Args) => void) & {
  /** 대기 중인 트레일링 호출을 버린다. 언마운트 시 호출할 것. */
  cancel: () => void;
};

export function throttle<Args extends unknown[]>(
  fn: (...args: Args) => void,
  waitMs: number = DRAG_THROTTLE_MS,
): Throttled<Args> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Args | null = null;

  const startCooldown = () => {
    timer = setTimeout(() => {
      timer = null;

      if (pendingArgs) {
        const args = pendingArgs;
        pendingArgs = null;
        fn(...args);
        startCooldown();
      }
    }, waitMs);
  };

  const throttled = (...args: Args) => {
    if (timer) {
      pendingArgs = args;
      return;
    }

    fn(...args);
    startCooldown();
  };

  throttled.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pendingArgs = null;
  };

  return throttled;
}
