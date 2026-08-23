import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ensureContract, signContract } from "../../lib/api/contracts";
import type { Contract } from "../../lib/schemas/contract";

/** 계약 화면이 쓰는 서버 상태. */

export function contractQueryKey(reservationId: number) {
  return ["reservations", reservationId, "contract"] as const;
}

/**
 * 예약 요청의 계약을 확보한다 — 없으면 만든다(`ensureContract`).
 *
 * **재시도를 끄는 이유**: 이 쿼리는 실패해도 부작용이 없는 순수 조회가 아니다. 내부에서 생성
 * POST까지 할 수 있어서, 기본 재시도에 맡기면 실패한 생성을 여러 번 되풀이하게 된다.
 */
export function useContract(reservationId: number) {
  return useQuery({
    queryKey: contractQueryKey(reservationId),
    queryFn: () => ensureContract(reservationId),
    enabled: Number.isFinite(reservationId),
    retry: false,
    staleTime: Infinity,
  });
}

/**
 * 전자 서명. 성공 응답이 갱신된 계약 전체이므로 캐시를 그 값으로 갈아끼운다
 * — 재조회를 한 번 더 돌리지 않아도 서명 시각이 바로 반영된다.
 */
export function useSignContract(reservationId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (contractId: number) => signContract(contractId),
    onSuccess: (signed: Contract) => {
      queryClient.setQueryData(contractQueryKey(reservationId), signed);
    },
  });
}
