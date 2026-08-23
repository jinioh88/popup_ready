import { apiRequest, ApiRequestError } from "./client";
import type { ErrorCode } from "./error-codes";
import { contractSchema, type Contract } from "../schemas/contract";

/**
 * 일시사용 표준 계약 (US-202).
 *
 * 응답은 경계에서 Zod로 파싱한다 — 핵심 3종 규약의 **PM 승인 예외**다(`schemas/contract.ts` 참조).
 */

/** `GET /reservation-requests/{id}/contract` — 없으면 404. */
export function getContractByReservation(reservationId: number): Promise<Contract> {
  return apiRequest<unknown>(`/reservation-requests/${reservationId}/contract`).then((data) =>
    contractSchema.parse(data),
  );
}

/** `POST /reservation-requests/{id}/contract` — 이미 있으면 409. */
export function createContract(reservationId: number): Promise<Contract> {
  return apiRequest<unknown>(`/reservation-requests/${reservationId}/contract`, {
    method: "POST",
  }).then((data) => contractSchema.parse(data));
}

/** `POST /contracts/{id}/sign` — 로그인 사용자 기준으로 서명 기록(본문 없음). */
export function signContract(contractId: number): Promise<Contract> {
  return apiRequest<unknown>(`/contracts/${contractId}/sign`, { method: "POST" }).then((data) =>
    contractSchema.parse(data),
  );
}

/**
 * 재진입까지 견디는 계약 확보 흐름 (PM 확정 2026-08-23).
 *
 *   GET → 404면 POST → POST가 409(경쟁 상황)면 GET 폴백
 *
 * POST를 멱등으로 만들지 않은 것은 **더블 서브밋 버그를 정상 동작으로 위장시키지 않기 위해서**다.
 * 그래서 "없으면 만든다"는 판단을 서버가 아니라 이 함수가 진다.
 */
export async function ensureContract(reservationId: number): Promise<Contract> {
  try {
    return await getContractByReservation(reservationId);
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
  }

  try {
    return await createContract(reservationId);
  } catch (error) {
    if (hasCode(error, "CONTRACT_ALREADY_EXISTS")) {
      // 다른 탭·중복 클릭이 방금 만들었다. 만들어진 것을 읽어 오면 사용자 입장에서는 성공이다.
      return getContractByReservation(reservationId);
    }
    throw error;
  }
}

/**
 * 판정은 상태 코드가 아니라 **에러 코드**로 한다(web/CLAUDE.md 백엔드 연동 규약).
 * 같은 404·409라도 사유가 여럿이라, 상태 코드로 묶으면 엉뚱한 사유까지 같은 분기로 빨려 들어간다.
 */
function hasCode(error: unknown, code: ErrorCode): boolean {
  return error instanceof ApiRequestError && error.code === code;
}

/** 계약이 아직 없다 — 생성으로 넘어가도 되는 유일한 사유다. */
function isNotFound(error: unknown): boolean {
  return hasCode(error, "CONTRACT_NOT_FOUND");
}
