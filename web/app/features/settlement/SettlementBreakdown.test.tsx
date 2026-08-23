// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

import { SettlementBreakdown } from "./SettlementBreakdown";
import type { Settlement } from "../../lib/settlement/breakdown";

/** 실서버 응답 그대로 (예약 1148, 결제액 1,329,000원). */
const SETTLEMENTS: Settlement[] = [
  { type: "SPACE_RENT", payeeId: 24, grossAmount: 1_140_000, feeAmount: 114_000, netAmount: 1_026_000, status: "PENDING" },
  { type: "FIXTURE_RENTAL", payeeId: 25, grossAmount: 75_000, feeAmount: 7_500, netAmount: 67_500, status: "PENDING" },
  { type: "DEPOSIT", payeeId: 23, grossAmount: 114_000, feeAmount: 0, netAmount: 114_000, status: "ESCROW_HELD" },
  { type: "PLATFORM_FEE", payeeId: 26, grossAmount: 121_500, feeAmount: 0, netAmount: 0, status: "PENDING" },
];

const PAID = 1_329_000;

afterEach(cleanup);

describe("SettlementBreakdown — 네 행의 의미가 다르다", () => {
  it("플랫폼 수수료를 0원으로 표시하지 않는다", () => {
    // netAmount가 0이라 그대로 그리면 "플랫폼이 0원을 가져간다"로 읽힌다.
    render(<SettlementBreakdown settlements={SETTLEMENTS} paidAmount={PAID} />);

    const row = screen.getByText("플랫폼 수수료").closest("div")!;

    expect(within(row).getByText("121,500원")).toBeTruthy();
  });

  it("공간 대여료는 수수료를 뗀 순액을 보여준다", () => {
    render(<SettlementBreakdown settlements={SETTLEMENTS} paidAmount={PAID} />);

    // gross 1,140,000이 아니라 실제로 가는 net 1,026,000이다.
    expect(screen.getByText("1,026,000원")).toBeTruthy();
    expect(screen.queryByText("1,140,000원")).toBeNull();
  });

  it("보증금이 돌려받는 돈임을 글자로 말한다", () => {
    render(<SettlementBreakdown settlements={SETTLEMENTS} paidAmount={PAID} />);

    expect(screen.getByText(/퇴실 검수 후 돌려받습니다/)).toBeTruthy();
    // 색이 아니라 뱃지 글자로도 상태를 전달한다.
    expect(screen.getAllByText("에스크로 보관 중").length).toBeGreaterThan(0);
  });

  it("돈이 누구에게 가는지 행마다 다르게 적는다", () => {
    // 방향(payout)으로 뭉뚱그리면 공간 대여료와 집기 렌털료가 같은 문구가 되어
    // 어느 돈이 누구에게 가는지 알 수 없다 — 수취인이 다르다.
    render(<SettlementBreakdown settlements={SETTLEMENTS} paidAmount={PAID} />);

    expect(screen.getByText("건물주에게 지급")).toBeTruthy();
    expect(screen.getByText("가구사에게 지급")).toBeTruthy();
    expect(screen.getByText("플랫폼 수수료로 차감")).toBeTruthy();
  });
});

describe("SettlementBreakdown — 합계 검산", () => {
  it("맞으면 경고하지 않는다", () => {
    render(<SettlementBreakdown settlements={SETTLEMENTS} paidAmount={PAID} />);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("1원이라도 어긋나면 숨기지 않고 드러낸다", () => {
    // 화면이 감추면 아무도 모른다.
    const broken = [...SETTLEMENTS];
    broken[0] = { ...broken[0], netAmount: broken[0].netAmount - 1 };

    render(<SettlementBreakdown settlements={broken} paidAmount={PAID} />);

    expect(screen.getByRole("alert").textContent).toContain("맞지 않습니다");
  });

  it("내역이 비어 있는데 결제액이 있으면 경고한다", () => {
    render(<SettlementBreakdown settlements={[]} paidAmount={PAID} />);

    expect(screen.getByRole("alert")).toBeTruthy();
  });
});

describe("SettlementBreakdown — 접근성", () => {
  it("이름을 가진 region으로 노출된다", () => {
    render(<SettlementBreakdown settlements={SETTLEMENTS} paidAmount={PAID} />);

    expect(screen.getByRole("region", { name: "정산 내역" })).toBeTruthy();
  });
});
