/**
 * 응답이 없어도 반드시 끝나게 만든다.
 *
 * US-301에서 ①(승인)만 하고 ③(마감) 없이 끝나는 경로를 만들지 않기 위한 장치다 —
 * 발행 콜백이 영영 오지 않으면 흐름이 멈춘 채 "전송 기록"이 성립하지 않는다.
 */
export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`${ms}ms 안에 응답이 없었다.`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
