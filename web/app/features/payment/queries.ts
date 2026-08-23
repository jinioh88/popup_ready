import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  confirmPayment,
  listSettlements,
  preparePayment,
  type PaymentConfirm,
} from "../../lib/api/payments";
import { getReservationRequest } from "../../lib/api/reservations";

/** 결제 화면의 서버 상태. */

export function reservationQueryKey(reservationId: number) {
  return ["reservation-requests", reservationId] as const;
}

export function settlementsQueryKey(reservationId: number) {
  return ["settlements", reservationId] as const;
}

/**
 * 분할 정산 내역 (US-203). **결제가 끝난 예약에만 존재한다.**
 *
 * 결제 승인 응답도 같은 내역을 들고 오므로, 방금 결제한 경우에는 그 값을 캐시에 심어
 * 왕복을 아낀다(`usePayReservation`). 이 쿼리는 **재진입 경로**를 위한 것이다.
 */
export function useSettlements(reservationId: number, enabled: boolean) {
  return useQuery({
    queryKey: settlementsQueryKey(reservationId),
    queryFn: () => listSettlements(reservationId),
    enabled: Number.isFinite(reservationId) && enabled,
  });
}

/**
 * 예약 단건 + 견적 스냅샷.
 *
 * **결제 화면이 금액의 원장으로 삼는 값이다.** 빌더의 실시간 견적은 표시용 미리보기이고,
 * 여기서부터는 서버가 보관한 스냅샷만 쓴다(§2.2-E).
 */
export function useReservation(reservationId: number) {
  return useQuery({
    queryKey: reservationQueryKey(reservationId),
    queryFn: () => getReservationRequest(reservationId),
    enabled: Number.isFinite(reservationId),
  });
}

/**
 * 결제 준비 → 승인.
 *
 * **한 뮤테이션으로 묶는다.** `prepare`와 `confirm`을 화면이 따로 부르게 하면 "재시도는
 * `prepare`부터"라는 규약을 화면마다 다시 지켜야 하고, 한 곳이라도 `confirm`만 다시 부르면
 * 소진된 `orderId`로 500을 맞는다(2026-08-23 실서버 확인). 순서를 여기 가둔다.
 *
 * `paymentKey`는 결제 수단(토스 위젯)이 만들어 준다. 위젯이 붙기 전에는 목 PG가 접두로
 * 결과를 가르므로(`DECLINE-`·`TIMEOUT-`) 개발 중에도 전 분기를 밟을 수 있다.
 */
export function usePayReservation(reservationId: number) {
  const queryClient = useQueryClient();

  return useMutation<PaymentConfirm, unknown, { paymentKey: string }>({
    mutationFn: async ({ paymentKey }) => {
      // 매번 새 orderId를 받는다 — 재사용하면 "승인됐는데 응답만 유실된" 경우를 구분할 수 없다.
      const prepared = await preparePayment(reservationId);

      return confirmPayment(reservationId, {
        paymentKey,
        orderId: prepared.orderId,
        // **서버가 준 금액을 그대로 되돌려준다.** 프론트가 계산해 만들면 서버의 금액 대조가
        // 프론트를 검증하는 꼴이 되어 의미를 잃는다(§2.2-C 2-5).
        amount: prepared.amount,
      });
    },
    onSuccess: (confirmed) => {
      // 승인 응답이 이미 정산 내역을 들고 있다 — 같은 것을 다시 받지 않는다.
      queryClient.setQueryData(settlementsQueryKey(reservationId), confirmed.settlements);
    },
    onSettled: () => {
      // 성공이든 실패든 예약 상태가 바뀌었을 수 있다(PAYMENT_PENDING·PAID).
      // 특히 PAYMENT_RESULT_UNKNOWN에서는 **화면이 아니라 서버가 진실**이므로 다시 읽는다.
      void queryClient.invalidateQueries({ queryKey: reservationQueryKey(reservationId) });
    },
  });
}
