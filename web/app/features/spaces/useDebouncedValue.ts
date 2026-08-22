import { useEffect, useState } from "react";

/**
 * 값이 잠잠해질 때까지 갱신을 미룬다.
 *
 * 지도 이동·줌과 필터 입력이 곧바로 `GET /spaces` 호출로 이어지면 요청이 폭주한다
 * (sprint1.md §3 US-101 "디바운스 적용").
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
