import { useCallback, useEffect, useState } from "react";

/**
 * 잠깐 떴다 사라지는 안내 문구.
 *
 * 배치 거부처럼 **다음 조작으로 자연히 해소되는** 알림에 쓴다. 남겨두면 이미 고친 문제를
 * 계속 지적하는 것처럼 보이고, 사용자는 그걸 닫으려고 다시 조작한다.
 *
 * 같은 문구가 다시 오면 타이머가 처음부터 다시 간다 — 연속 거부 중에 문구가 먼저 사라지면
 * 마지막 거부만 조용해진다.
 */
export function useTransientMessage(durationMs = 2500) {
  const [message, setMessage] = useState<string | null>(null);
  // 같은 문구가 연달아 와도 타이머를 다시 걸기 위한 값. 문구만으로는 변화를 감지할 수 없다.
  const [issuedAt, setIssuedAt] = useState(0);

  const show = useCallback((next: string) => {
    setMessage(next);
    setIssuedAt((count) => count + 1);
  }, []);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = setTimeout(() => setMessage(null), durationMs);
    return () => clearTimeout(timer);
  }, [message, issuedAt, durationMs]);

  return { message, show };
}
