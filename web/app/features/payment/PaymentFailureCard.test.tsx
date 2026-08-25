// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { PaymentFailureCard } from "./PaymentFailureCard";
import { paymentFailure } from "./failureMessage";
import { ApiRequestError } from "../../lib/api/client";

afterEach(cleanup);

function renderFailure(code: string, status = 400) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <PaymentFailureCard
            failure={paymentFailure(new ApiRequestError(status, code, "서버 문구"))}
            reservationId={7}
            spaceId={24}
          />
        ),
      },
    ],
    { initialEntries: ["/"] },
  );

  render(<RouterProvider router={router} />);
}

describe("PaymentFailureCard — 재시도 경로 안내", () => {
  it("다시 시도해도 되는 실패는 아래 패널을 가리킨다", () => {
    // 카드 자체에는 재시도 버튼을 두지 않는다 — 같은 일을 하는 것이 둘이 되면 갈라진다.
    renderFailure("LOCK_ACQUISITION_FAILED", 503);

    expect(screen.getByText(/아래 결제 수단에서 다시 시도/)).toBeTruthy();
  });

  it("승인 여부 불명에는 재시도를 권하지 않는다", () => {
    renderFailure("PAYMENT_RESULT_UNKNOWN", 503);

    expect(screen.queryByText(/다시 시도/)).toBeNull();
    expect(screen.getByRole("link", { name: "예약 상세 확인" })).toBeTruthy();
  });

  it("어떤 실패 카드에도 결제를 실행하는 버튼이 없다", () => {
    // 결제를 실행하는 곳은 결제 수단 패널 하나뿐이어야 한다.
    for (const code of ["LOCK_ACQUISITION_FAILED", "PAYMENT_RESULT_UNKNOWN", "PAYMENT_DECLINED"]) {
      cleanup();
      renderFailure(code, 503);

      expect(screen.queryByRole("button", { name: /결제하기/ })).toBeNull();
    }
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

describe("PaymentFailureCard — 뱃지는 조치 가능성을 말한다", () => {
  it("재시도로 풀리는 실패에 '처리 중단'을 달지 않는다", () => {
    /*
     * 이 테스트는 예전에 정반대를 검증했다 — 뱃지를 `causedByUser`(누구 잘못인가)에서
     * 뽑았기 때문에 "사용자 잘못이 아니면 처리 중단"이 규칙이었다. 그래서 제목이
     * "잠시 후 다시 시도해 주세요"인 카드에 "처리 중단" 뱃지가 붙어 있었고,
     * **한 카드가 정면으로 반대되는 두 말을 했다**(§8.12).
     */
    renderFailure("LOCK_ACQUISITION_FAILED", 503);

    expect(screen.queryByText("처리 중단")).toBeNull();
    expect(screen.getByText("확인 필요")).toBeTruthy();
  });

  it("뱃지가 버튼과 어긋나지 않는다", () => {
    // 기간을 다시 고르라는 버튼이 있는데 뱃지가 멈췄다고 말하면, 둘 중 하나는 거짓말이다.
    renderFailure("SPACE_ALREADY_BOOKED", 409);

    expect(screen.getByRole("link", { name: "기간 다시 선택" })).toBeTruthy();
    expect(screen.getByText("확인 필요")).toBeTruthy();
  });

  it("할 수 있는 일이 없을 때만 '처리 중단'이다", () => {
    renderFailure("FORBIDDEN", 403);

    expect(screen.getByText("처리 중단")).toBeTruthy();
  });

  it("실패 안내를 alert로 노출한다", () => {
    renderFailure("PAYMENT_DECLINED", 402);

    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
