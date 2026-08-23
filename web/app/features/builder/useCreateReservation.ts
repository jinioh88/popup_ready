import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { ApiRequestError } from "../../lib/api/client";
import { createReservationRequest } from "../../lib/api/reservations";
import type { ReservationPeriod } from "../../lib/schemas/reservation";
import { useBuilderStore } from "../../stores/builder";
import { spaceDetailQueryKey } from "./queries";

/**
 * 빌더에서 만든 레이아웃으로 예약 요청을 만든다.
 *
 * 레이아웃 검증의 원장은 서버다 — 웹이 통과시킨 배치라도 400이 올 수 있고(계산식 불일치·재고 부족),
 * 그때는 **조용히 넘기지 않고** 사유를 그대로 보여준다. 이 경로가 계약 불일치를 드러내는 창구다.
 *
 * **전력 한도는 서버가 최종 판정한다**(sprint2.md §2.2-D). 화면의 `LimitGauge`가 제출 버튼을
 * 잠그는 것은 UX이지 게이트가 아니므로, 400 `POWER_LIMIT_EXCEEDED`가 오는 경로를 정상 경로로
 * 처리한다 — "프론트에서 막았으니 서버는 안 막아도 된다"고 가정하지 않는다.
 * **면적은 서버가 판정하지 않는다**(§2.2-F로 `AREA_LIMIT_EXCEEDED` 철회).
 *
 * `VALIDATION_FAILED`는 서버가 요청 자체를 물린 경우다. 그중 하나가 **낡은 그리드**로,
 * 요청 레이아웃의 gridCols·gridRows·cellSizeMm가 `GET /spaces/{id}`의 현재 값과 다르면 400이다
 * (sprint1.md §2.2, 2026-08-23). 이때 필요한 건 재시도가 아니라 **상세 재조회**이므로
 * 공간 상세 쿼리를 무효화해 다음 렌더에서 그리드가 다시 맞춰지게 한다.
 */

function messageOf(error: unknown): string {
  if (!(error instanceof ApiRequestError)) {
    return "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  }

  switch (error.code) {
    case "LAYOUT_OUT_OF_BOUNDS":
      return "서버 검증에서 도면 범위를 벗어난 집기가 발견됐습니다. 배치를 다시 확인해 주세요.";
    case "LAYOUT_OVERLAP":
      return "서버 검증에서 집기 겹침이 발견됐습니다. 배치를 다시 확인해 주세요.";
    case "FIXTURE_STOCK_EXCEEDED":
      return "선택한 집기의 재고가 부족합니다. 수량을 줄여 주세요.";
    case "FIXTURE_UNAVAILABLE":
      return "선택한 기간에 품절인 집기가 있습니다. 기간을 바꾸거나 다른 집기로 교체해 주세요.";
    case "POWER_LIMIT_EXCEEDED":
      // 화면의 LimitGauge가 이미 막고 있어야 하는 상태다. 그런데도 이 코드가 왔다는 것은
      // 프론트 계산과 서버 계산이 어긋났다는 뜻이므로 **재시도를 권하지 않는다** —
      // 같은 배치로 다시 눌러도 같은 400이 온다. 계약 불일치를 드러내는 창구다.
      return `${error.message} 화면의 전력 합계와 서버 판정이 어긋났습니다 — 집기를 줄인 뒤 다시 시도해 주세요.`;
    case "SPACE_NOT_FOUND":
      return "상가 정보를 찾을 수 없습니다.";
    case "FIXTURE_NOT_FOUND":
      return "집기 정보를 찾을 수 없습니다. 목록을 새로고침해 주세요.";
    case "VALIDATION_FAILED":
      // 서버 메시지가 어긋난 값을 짚어 준다("공간: 20×12, 셀 500mm"). 임의 문구로 덮지 않는다.
      return `${error.message} 도면 정보를 다시 불러왔습니다 — 배치를 확인한 뒤 다시 시도해 주세요.`;
    default:
      return error.message;
  }
}

export function useCreateReservation(spaceId: number) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (period: ReservationPeriod) =>
      createReservationRequest({
        spaceId,
        startDate: period.startDate,
        endDate: period.endDate,
        layout: useBuilderStore.getState().toLayout(),
      }),
    onSuccess: (reservation) => {
      void navigate(`/reservations/${reservation.id}/contract`);
    },
    onError: (error) => {
      if (error instanceof ApiRequestError && error.code === "VALIDATION_FAILED") {
        void queryClient.invalidateQueries({ queryKey: spaceDetailQueryKey(spaceId) });
      }
    },
  });

  return {
    submit: (period: ReservationPeriod) => mutation.mutateAsync(period).catch(() => undefined),
    isPending: mutation.isPending,
    errorMessage: mutation.isError ? messageOf(mutation.error) : undefined,
  };
}
