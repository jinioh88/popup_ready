import { BASE_DELAY_MS, MAX_DELAY_MS, nextDelayMs } from "../src/lib/mqtt/backoff";

/** 지터를 고정해 경계를 직접 짚는다. */
const lowest = () => 0;
const highest = () => 1;

describe("nextDelayMs", () => {
  it("시도가 늘수록 지연이 2배로 늘어난다", () => {
    const delays = [1, 2, 3, 4, 5].map((attempt) => nextDelayMs(attempt, highest));
    expect(delays).toEqual([1_000, 2_000, 4_000, 8_000, 16_000]);
  });

  it("상한을 넘지 않는다", () => {
    // 6번째면 32s가 되지만 상한에 걸린다. 이보다 길면 앱이 죽은 것으로 보인다.
    expect(nextDelayMs(6, highest)).toBe(MAX_DELAY_MS);
    expect(nextDelayMs(20, highest)).toBe(MAX_DELAY_MS);
  });

  it("지터가 계산값의 절반 아래로는 내려가지 않는다", () => {
    // 0ms로 붙으면 재시도가 폭주한다. 하한이 그것을 막는다.
    expect(nextDelayMs(1, lowest)).toBe(BASE_DELAY_MS / 2);
    expect(nextDelayMs(5, lowest)).toBe(8_000);
    expect(nextDelayMs(99, lowest)).toBe(MAX_DELAY_MS / 2);
  });

  it("같은 시도라도 지터로 값이 흩어진다", () => {
    // 지터가 없으면 여러 기기가 복구 순간에 같은 밀리초로 몰려 브로커를 다시 밀어낸다.
    expect(nextDelayMs(3, lowest)).not.toBe(nextDelayMs(3, highest));
  });

  it("0이나 음수 시도도 첫 시도로 다룬다", () => {
    expect(nextDelayMs(0, highest)).toBe(BASE_DELAY_MS);
    expect(nextDelayMs(-5, highest)).toBe(BASE_DELAY_MS);
  });
});
