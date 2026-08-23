// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { PaymentMethodPanel } from "./PaymentMethodPanel";
import type { ReservationRequest } from "../../lib/schemas/api";

afterEach(cleanup);

function renderPanel(status: ReservationRequest["status"]) {
  const onPay = vi.fn();
  render(<PaymentMethodPanel status={status} isPending={false} onPay={onPay} />);
  return onPay;
}

describe("PaymentMethodPanel — 결제할 수 없는 상태", () => {
  it("서명이 안 끝났으면 누구의 서명이 남았는지 알린다", () => {
    // 서버 문구는 "계약 서명이 끝난 예약만 결제할 수 있습니다"로 끝나 누가 남았는지 모른다.
    renderPanel("CONTRACT_PENDING");

    expect(screen.getByText(/양 당사자의 서명이 모두 끝나야/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "결제하기" })).toBeNull();
  });

  it("이미 결제됐으면 중복 청구가 아님을 먼저 말한다", () => {
    // 서버는 이 상태에서 "계약 서명이 끝난 예약만…"이라는 **사실과 다른 문구**를 준다.
    renderPanel("PAID");

    expect(screen.getByText(/중복으로 청구되지 않았습니다/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "결제하기" })).toBeNull();
  });

  it("취소된 예약은 결제할 수 없다", () => {
    renderPanel("CANCELLED");

    expect(screen.queryByRole("button", { name: "결제하기" })).toBeNull();
  });
});

describe("PaymentMethodPanel — 결제 가능한 상태", () => {
  it("서명이 끝나면 결제할 수 있다", () => {
    const onPay = renderPanel("CONTRACT_SIGNED");

    const input = screen.getByLabelText(/결제 키/);
    fireEvent.change(input, { target: { value: "NORMAL-1" } });
    fireEvent.click(screen.getByRole("button", { name: "결제하기" }));

    expect(onPay).toHaveBeenCalledWith("NORMAL-1");
  });

  it("결제 확인 중 상태에서도 재시도할 수 있다", () => {
    // 앞선 시도가 거절돼 PAYMENT_PENDING으로 남은 경우다 — 여기서 막으면 되돌릴 길이 없다.
    renderPanel("PAYMENT_PENDING");

    expect(screen.getByRole("button", { name: "결제하기" })).toBeTruthy();
  });

  it("키가 비어 있으면 결제를 시작하지 않는다", () => {
    const onPay = renderPanel("CONTRACT_SIGNED");

    fireEvent.click(screen.getByRole("button", { name: "결제하기" }));

    expect(onPay).not.toHaveBeenCalled();
  });
});
