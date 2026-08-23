import { authedRequest } from "./authed-client";
import type { components } from "./schema";

/**
 * 내 예약 목록·단건 (지시서 §2.2-A).
 *
 * **조회 조건이 곧 인가다** — 서버는 로그인한 사용자가 만든 예약만 최근 순으로 돌려주며,
 * 남의 예약을 볼 경로 자체가 없다. 그래서 **403 분기를 만들지 않는다**(백엔드 설계 결정,
 * 2026-08-23). 건물주의 "내 공간 예약 목록"은 조회 축이 다른 별개 유스케이스다.
 */
export type ReservationSummary = components["schemas"]["ReservationRequestResponse"];
export type ReservationStatus = NonNullable<ReservationSummary["status"]>;

/**
 * 목록은 Zod로 굳히지 않는다.
 *
 * 치명도 기준(Sprint 1 규약)에 따른 것이다 — 목록의 필드가 비어도 화면에 덜 그려질 뿐,
 * 토큰이나 발행 토픽처럼 **틀린 채로 흘러가면 되돌릴 수 없는 값이 아니다.** 필드 존재는
 * 생성 타입이 계약으로 보장하고, 화면은 없는 값을 방어적으로 그린다.
 */
export async function fetchMyReservations(
  baseUrl: string,
  status?: ReservationStatus,
  options?: { fetchImpl?: typeof fetch },
): Promise<ReservationSummary[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await authedRequest(baseUrl, `/reservation-requests${query}`, {
    fetchImpl: options?.fetchImpl,
  });

  return Array.isArray(data) ? (data as ReservationSummary[]) : [];
}

export async function fetchReservation(
  baseUrl: string,
  id: number,
  options?: { fetchImpl?: typeof fetch },
): Promise<ReservationSummary> {
  const data = await authedRequest(baseUrl, `/reservation-requests/${id}`, {
    fetchImpl: options?.fetchImpl,
  });

  return data as ReservationSummary;
}

/**
 * 상태 → 화면 문구.
 *
 * **`Record<ReservationStatus, string>`으로 못 박는다.** 계약에 상태가 추가되면 여기서
 * 컴파일이 깨진다 — 그게 정상 신호다. `Record<string, string>`으로 두면 새 상태가 조용히
 * 폴백으로 흘러 화면에 영문 enum이 그대로 뜬다(2026-08-23 `PAYMENT_PENDING`·`PAID`·
 * `CANCELLED` 추가 때 실제로 그럴 뻔했다).
 */
export const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  DRAFT: "작성 중",
  CONTRACT_PENDING: "계약 대기",
  CONTRACT_SIGNED: "계약 완료",
  PAYMENT_PENDING: "결제 대기",
  PAID: "결제 완료",
  CANCELLED: "취소됨",
};

/**
 * 타입이 못 잡는 경우(서버가 계약 밖 값을 보냄)에는 원문을 그대로 보여준다.
 * 빈칸으로 두면 화면에서 상태가 사라져 더 나쁘다.
 */
export function reservationStatusLabel(status: string): string {
  return RESERVATION_STATUS_LABEL[status as ReservationStatus] ?? status;
}

/** 예약 ID는 경로 파라미터로 문자열로 들어온다. 숫자가 아니면 요청을 보내지 않는다. */
export function parseReservationId(raw: string | undefined): number | null {
  if (!raw) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}
