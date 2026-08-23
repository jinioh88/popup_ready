import { apiRequest, type Schemas } from "./client";
import { reservationRequestSchema, type ReservationRequest } from "../schemas/api";

/**
 * 예약 요청 생성 (`POST /reservation-requests`).
 *
 * 핵심 응답 3종이라 경계에서 Zod로 파싱한다. 레이아웃 재검증은 **서버가 원장**이며,
 * 범위 초과·겹침이면 400과 함께 LAYOUT_* 에러 코드가 온다.
 */
export async function createReservationRequest(
  body: Schemas["CreateReservationRequest"],
): Promise<ReservationRequest> {
  const data = await apiRequest<unknown>("/reservation-requests", { method: "POST", body });
  return reservationRequestSchema.parse(data);
}

/**
 * 예약 요청 단건 조회 (`GET /reservation-requests/{id}`).
 *
 * **견적 스냅샷을 포함한다** — 계약·결제 단계는 재계산이 아니라 이 값을 참조한다(§2.2-E).
 * 재진입·결제 화면·결과 확인이 공유하는 단일 조회 경로다.
 *
 * Zod 파싱 대상 5종째다(PM 승인 2026-08-23). 근거는 계약 응답과 같은 치명도 —
 * `PriceIntegrityCard`가 "1원도 변하지 않는다"를 약속하는데 그 근거인 스냅샷 금액이
 * 조용히 훼손된 채 렌더되면 사용자가 **다른 금액에 동의**하게 된다.
 */
export async function getReservationRequest(id: number): Promise<ReservationRequest> {
  const data = await apiRequest<unknown>(`/reservation-requests/${id}`);
  return reservationRequestSchema.parse(data);
}
