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
