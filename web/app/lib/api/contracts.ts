import { apiRequest, ApiRequestError } from "./client";
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
 *
 * 409 분기는 상태 코드로 한다 — `CONTRACT_ALREADY_EXISTS` 코드 상수는 T5-3 머지 후
 * 타입 재생성 시점에 `ERROR_CODES`로 들어온다(지금 손으로 넣으면 계약 집합 단언이 깨진다).
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
    if (error instanceof ApiRequestError && error.status === 409) {
      // 다른 탭·중복 클릭이 방금 만들었다. 만들어진 것을 읽어 오면 사용자 입장에서는 성공이다.
      return getContractByReservation(reservationId);
    }
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 404;
}
