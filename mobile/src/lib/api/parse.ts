import type { z } from "zod";

import { ApiRequestError } from "./client";

/**
 * 계약 위반을 조용히 넘기지 않는다.
 *
 * 생성 타입만으로는 응답을 믿을 수 없고, 값이 틀린 채 흘러가면 되돌릴 수 없는 자리들이 있다 —
 * 토큰이 없으면 이후 요청이 전부 조용히 죽고, 발행 토픽이 훼손되면 엉뚱한 공간의 도어락에
 * 신호가 간다. 경계에서 끊는 편이 싸다.
 */
export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const parsed = schema.safeParse(data);
  if (parsed.success) return parsed.data;

  throw new ApiRequestError(
    "INTERNAL_ERROR",
    `${label}이 계약과 다르다: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    null,
  );
}
