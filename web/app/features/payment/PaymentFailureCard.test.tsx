// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { PaymentFailureCard } from "./PaymentFailureCard";
import { paymentFailure } from "./failureMessage";
import { ApiRequestError } from "../../lib/api/client";

afterEach(cleanup);

function renderFailure(code: string, status = 400) {
  const onRetry = vi.fn();
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <PaymentFailureCard
            failure={paymentFailure(new ApiRequestError(status, code, "서버 문구"))}
            reservationId={7}
            spaceId={24}
            onRetry={onRetry}
          />
        ),
      },
    ],
    { initialEntries: ["/"] },
  );

  render(<RouterProvider router={router} />);
  return onRetry;
}

describe("PaymentFailureCard — 재시도 버튼의 유무", () => {
  it("락 실패에는 재시도 버튼을 준다", () => {
    renderFailure("LOCK_ACQUISITION_FAILED", 503);

    expect(screen.getByRole("button", { name: "다시 결제하기" })).toBeTruthy();
  });

  it("승인 여부 불명에는 재시도 버튼을 주지 않는다", () => {
    // 같은 503이지만 이 버튼이 곧 이중 결제다.
    renderFailure("PAYMENT_RESULT_UNKNOWN", 503);

    expect(screen.queryByRole("button", { name: "다시 결제하기" })).toBeNull();
    expect(screen.getByRole("link", { name: "예약 상세 확인" })).toBeTruthy();
  });

  it("모르는 실패에도 재시도 버튼을 주지 않는다", () => {
    renderFailure("INTERNAL_ERROR", 500);

    expect(screen.queryByRole("button", { name: "다시 결제하기" })).toBeNull();
  });
});

describe("PaymentFailureCard — 해소 경로", () => {
  it("기간 충돌은 빌더로 보낸다", () => {
    renderFailure("SPACE_ALREADY_BOOKED", 409);

    expect(screen.getByRole("link", { name: "기간 다시 선택" }).getAttribute("href")).toBe(
      "/spaces/24/builder",
    );
  });

  it("집기 품절은 배치 수정으로 보낸다", () => {
    renderFailure("FIXTURE_UNAVAILABLE", 409);

    expect(screen.getByRole("link", { name: "배치 수정" })).toBeTruthy();
  });

  it("어떤 실패에서도 예약 상세로 빠져나갈 수 있다", () => {
    // 결제 화면에 갇히면 사용자는 새로고침·뒤로가기로 나가고 그 과정에서 다시 결제한다.
    renderFailure("PAYMENT_DECLINED", 402);

    expect(screen.getByRole("link", { name: "예약 상세로" })).toBeTruthy();
  });
});

describe("PaymentFailureCard — 책임 소재", () => {
  it("사용자 잘못이 아닌 실패는 '확인 필요'로 몰지 않는다", () => {
    renderFailure("LOCK_ACQUISITION_FAILED", 503);

    expect(screen.getByText("처리 중단")).toBeTruthy();
  });

  it("실패 안내를 alert로 노출한다", () => {
    renderFailure("PAYMENT_DECLINED", 402);

    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
