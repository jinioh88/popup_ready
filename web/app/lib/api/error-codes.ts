import type { components } from "./schema";

/**
 * 백엔드가 공유하는 에러 코드 목록 (`backend/.../common/ErrorCode.java`).
 *
 * 클라이언트는 이 이름으로 분기한다 — 임의 문자열로 분기하지 않는다.
 * 백엔드에서 상수 이름이 바뀌면 API 계약 변경이므로 스프린트 문서 갱신 + PM 보고가 함께 온다.
 */
export const ERROR_CODES = [
  // 공통
  "VALIDATION_FAILED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "METHOD_NOT_ALLOWED",
  "UNSUPPORTED_MEDIA_TYPE",
  "INTERNAL_ERROR",
  // auth
  "EMAIL_ALREADY_EXISTS",
  "INVALID_CREDENTIALS",
  // space / fixture
  "SPACE_NOT_FOUND",
  "FIXTURE_NOT_FOUND",
  // reservation
  "RESERVATION_REQUEST_NOT_FOUND",
  "LAYOUT_OUT_OF_BOUNDS",
  "LAYOUT_OVERLAP",
  "FIXTURE_STOCK_EXCEEDED",
  // contract
  "CONTRACT_NOT_FOUND",
  "NOT_CONTRACT_PARTY",
  "CONTRACT_ALREADY_SIGNED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/**
 * 계약이 생성한 유니온과 이 목록이 **정확히 같은 집합**인지 컴파일 타임에 고정한다.
 * 런타임 판별(`isErrorCode`)에는 값 배열이 필요해 목록 자체는 남기되, 백엔드가 코드를
 * 추가·삭제하면 타입 재생성 시점에 여기서 깨진다.
 */
type ContractErrorCode = components["schemas"]["ApiError"]["code"];
type Assert<T extends true> = T;

export type ErrorCodesMatchContract = Assert<
  [ErrorCode] extends [ContractErrorCode]
    ? [ContractErrorCode] extends [ErrorCode]
      ? true
      : false
    : false
>;

export function isErrorCode(value: string): value is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(value);
}
