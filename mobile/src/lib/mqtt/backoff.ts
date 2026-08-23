/**
 * 재연결 백오프 (Sprint 1 §7 이월분).
 *
 * **mqtt.js의 `reconnectPeriod`로는 백오프가 되지 않는다** — 고정 간격이라 브로커가 내려간
 * 동안 같은 주기로 계속 두드린다. 그래서 자동 재연결을 끄고(`reconnectPeriod: 0`) 여기서
 * 계산한 지연으로 직접 스케줄링한다.
 *
 * React·Expo 무의존 순수 모듈(src/lib 규칙).
 */

/** 첫 재시도까지의 지연. */
export const BASE_DELAY_MS = 1_000;

/** 상한. 이보다 길면 사용자가 앱이 죽은 것으로 본다. */
export const MAX_DELAY_MS = 30_000;

/**
 * `attempt`번째 재시도까지 기다릴 시간(ms). `attempt`는 1부터 센다.
 *
 * 1s → 2s → 4s → 8s → 16s → 30s(상한)로 늘리되, 계산값의 **절반~전체 구간에서 흔든다.**
 * 지터가 없으면 여러 기기가 브로커 복구 순간에 같은 밀리초로 몰려 다시 밀어낸다.
 *
 * `random`은 주입받는다 — 순수 함수로 남겨 테스트가 경계를 직접 짚을 수 있게 한다.
 */
export function nextDelayMs(attempt: number, random: () => number = Math.random): number {
  const step = Math.max(1, Math.floor(attempt));
  const uncapped = BASE_DELAY_MS * 2 ** (step - 1);
  const capped = Math.min(uncapped, MAX_DELAY_MS);

  // [capped/2, capped] 구간. 하한을 두어 재시도가 0ms로 붙는 폭주를 막는다.
  const half = capped / 2;
  return Math.round(half + random() * half);
}
