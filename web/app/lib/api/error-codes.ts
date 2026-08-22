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

export function isErrorCode(value: string): value is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(value);
}
