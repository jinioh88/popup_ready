import { apiRequest, type Schemas } from "./client";

/**
 * 결제 준비·승인 (`POST /reservation-requests/{id}/payment/…`, US-201).
 *
 * **`prepare`는 락을 잡지 않는다**(sprint2.md §2.2-A) — 위젯을 띄우는 동안 남의 예약을 막지
 * 않기 위해서다. 그 대가로 기간 겹침은 `confirm` 단계에서야 드러난다(409 `SPACE_ALREADY_BOOKED`).
 *
 * **`prepare`는 양측 서명 완료(`CONTRACT_SIGNED`)를 전제한다.** 브랜드만 서명한 상태로 부르면
 * 400이다(2026-08-23 실서버 확인).
 *
 * **재시도는 언제나 `prepare`부터다.** `orderId`는 재사용되지 않는다 — 이미 승인 시도된 것을
 * 다시 쓰면 "실제로는 승인됐는데 응답만 유실된" 경우를 구분할 수 없기 때문이다.
 * 소진된 `orderId`로 `confirm`을 다시 부르면 서버가 500으로 떨어진다(같은 날 확인).
 */

export type PaymentPrepare = Schemas["PaymentPrepareResponse"];
export type PaymentConfirm = Schemas["PaymentConfirmResponse"];

export function preparePayment(reservationId: number): Promise<PaymentPrepare> {
  return apiRequest<PaymentPrepare>(`/reservation-requests/${reservationId}/payment/prepare`, {
    method: "POST",
  });
}

/**
 * 결제 승인.
 *
 * **`amount`는 `prepare`가 준 값을 그대로 되돌려준다 — 프론트가 계산해 만들지 않는다.**
 * 서버는 이 금액을 견적 스냅샷과 대조하는데(§2.2-C 2-5), 프론트가 자체 계산한 값을 보내면
 * 그 대조가 "프론트가 프론트를 검증하는" 꼴이 되어 의미를 잃는다.
 */
export function confirmPayment(
  reservationId: number,
  body: Schemas["PaymentConfirmRequest"],
): Promise<PaymentConfirm> {
  return apiRequest<PaymentConfirm>(`/reservation-requests/${reservationId}/payment/confirm`, {
    method: "POST",
    body,
  });
}

/**
 * 분할 정산 내역 (`GET /settlements?reservationId=`, US-203).
 *
 * 결제 승인 응답도 같은 내역을 들고 오지만, **재진입한 사용자**(결제를 마치고 나갔다가
 * 돌아온 경우)에게는 이 경로가 유일하다.
 */
export function listSettlements(reservationId: number): Promise<Schemas["SettlementResponse"][]> {
  return apiRequest<Schemas["SettlementResponse"][]>("/settlements", {
    query: { reservationId },
  });
}
