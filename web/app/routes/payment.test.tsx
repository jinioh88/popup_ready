// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";

import PaymentRoute from "./payment";
import { ApiRequestError } from "../lib/api/client";
import type { ReservationRequest } from "../lib/schemas/api";

/**
 * 결제 라우트 조립 테스트 (§8.5).
 *
 * **왜 컴포넌트가 아니라 라우트에서 검증하는가.** `6cc9830`이 세운 방어(직전 결과를 모르는
 * 실패에서 결제 수단을 치운다)가 재진입에서 사라진 이유는, 단위 테스트가 **카드 안**만 봤고
 * 화면에 무엇이 남았는지는 보지 않았기 때문이다. 같은 사각을 또 만들지 않으려면
 * **뮤테이션을 한 번도 거치지 않은 첫 진입**을 재현해야 하고, 그건 라우트에서만 된다 —
 * `PaymentMethodPanel`은 예약 상태만 알 뿐 "이번 세션에서 무슨 일이 있었는지"를 모른다.
 */

const useReservation = vi.fn();
const usePayReservation = vi.fn();
const useSettlements = vi.fn();

vi.mock("../features/payment/queries", () => ({
  useReservation: (...args: unknown[]) => useReservation(...args),
  usePayReservation: (...args: unknown[]) => usePayReservation(...args),
  useSettlements: (...args: unknown[]) => useSettlements(...args),
}));

afterEach(cleanup);

const RESERVATION: ReservationRequest = {
  id: 1156,
  spaceId: 24,
  brandUserId: 7,
  startDate: "2027-01-05",
  endDate: "2027-01-07",
  status: "CONTRACT_SIGNED",
  layout: { gridCols: 20, gridRows: 12, cellSizeMm: 500, items: [] },
  estimate: {
    days: 3,
    spaceRentTotal: 1_140_000,
    fixtureRentalTotal: 1_620_000,
    deposit: 114_000,
    totalAmount: 2_874_000,
  },
};

/** 결제 화면에 **처음 들어온** 상태. 뮤테이션은 한 번도 돌지 않았다. */
function enterPaymentScreen(status: ReservationRequest["status"]) {
  useReservation.mockReturnValue({
    isPending: false,
    isError: false,
    data: { ...RESERVATION, status },
  });
  useSettlements.mockReturnValue({ data: undefined });

  const Stub = createRoutesStub([
    {
      path: "/reservations/:reservationId/payment",
      // 라우트 모듈을 그대로 쓴다 — 조립 결과를 보는 것이 이 테스트의 목적이다.
      Component: PaymentRoute,
    },
  ]);

  render(<Stub initialEntries={["/reservations/1156/payment"]} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  usePayReservation.mockReturnValue({
    isError: false,
    isSuccess: false,
    isPending: false,
    data: undefined,
    error: null,
    mutate: vi.fn(),
  });
});

describe("결제 라우트 — 직전 결과를 모르는 채 재진입", () => {
  it("PAYMENT_PENDING으로 처음 들어오면 경고가 있다", () => {
    // `TIMEOUT-` 뒤 새로고침한 사용자가 정확히 이 상태로 들어온다. 뮤테이션 상태가
    // 초기화돼 failure가 null이므로, 화면이 기댈 곳은 예약 상태뿐이다.
    enterPaymentScreen("PAYMENT_PENDING");

    expect(screen.getByText(/직전 결제 결과가 확인되지 않았습니다/)).toBeTruthy();
    expect(screen.getByText(/이중으로 청구될 수 있습니다/)).toBeTruthy();
  });

  it("경고를 띄우되 결제를 막지는 않는다", () => {
    // PAYMENT_PENDING은 위젯을 닫고 돌아온 정상 경로이기도 하다 — 백엔드가 이 상태의
    // prepare를 일부러 허용한다(PaymentService). 막으면 정상 사용자가 결제를 못 한다.
    enterPaymentScreen("PAYMENT_PENDING");

    expect(screen.getByRole("button", { name: "결제하기" })).toBeTruthy();
    expect(screen.getByLabelText(/결제 키/)).toBeTruthy();
  });

  it('"실패"라고 쓰지 않는다 — 실패했는지 아닌지를 모르는 것이 이 상태의 정의다', () => {
    enterPaymentScreen("PAYMENT_PENDING");

    expect(screen.getByRole("alert").textContent).not.toMatch(/실패/);
  });

  it("거절(402) 뒤 재시도에는 경고를 띄우지 않는다 — 그때는 결과를 안다", () => {
    // 거절 뒤에도 예약 상태는 PAYMENT_PENDING이다(prepare가 이미 지나갔다). 상태만 보고
    // 판정하면 "결과를 모른다"고 쓰게 되는데, 여기서는 안다 — 거절됐다. 화면이 거짓을 말한다.
    usePayReservation.mockReturnValue({
      isError: true,
      isSuccess: false,
      isPending: false,
      data: undefined,
      error: new ApiRequestError(402, "PAYMENT_DECLINED", "결제가 거절됐습니다."),
      mutate: vi.fn(),
    });

    enterPaymentScreen("PAYMENT_PENDING");

    expect(screen.queryByText(/직전 결제 결과가 확인되지 않았습니다/)).toBeNull();
    // 거절은 재시도로 풀리는 실패다 — 결제 수단은 그대로 남아야 한다.
    expect(screen.getByRole("button", { name: "결제하기" })).toBeTruthy();
  });

  it("서명 직후(CONTRACT_SIGNED) 첫 결제에는 경고가 없다", () => {
    // 직전 시도가 없으므로 모를 것도 없다. 여기에 경고를 띄우면 정상 결제가 겁을 준다.
    enterPaymentScreen("CONTRACT_SIGNED");

    expect(screen.queryByText(/직전 결제 결과가 확인되지 않았습니다/)).toBeNull();
    expect(screen.getByRole("button", { name: "결제하기" })).toBeTruthy();
  });
});
