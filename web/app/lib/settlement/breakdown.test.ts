import { describe, expect, it } from "vitest";

import {
  isBalanced,
  summarizeSettlements,
  toSettlementRow,
  type Settlement,
} from "./breakdown";

/** 실서버 응답 그대로 (예약 1148, 결제액 1,329,000원). */
const SETTLEMENTS: Settlement[] = [
  { type: "SPACE_RENT", payeeId: 24, grossAmount: 1_140_000, feeAmount: 114_000, netAmount: 1_026_000, status: "PENDING" },
  { type: "FIXTURE_RENTAL", payeeId: 25, grossAmount: 75_000, feeAmount: 7_500, netAmount: 67_500, status: "PENDING" },
  { type: "DEPOSIT", payeeId: 23, grossAmount: 114_000, feeAmount: 0, netAmount: 114_000, status: "ESCROW_HELD" },
  { type: "PLATFORM_FEE", payeeId: 26, grossAmount: 121_500, feeAmount: 0, netAmount: 0, status: "PENDING" },
];

const PAID_AMOUNT = 1_329_000;

describe("toSettlementRow — type마다 다른 필드를 쓴다", () => {
  it("공간 대여료는 건물주가 받을 순액을 보여준다", () => {
    // gross(1,140,000)가 아니라 수수료를 뗀 net(1,026,000)이 실제로 가는 돈이다.
    expect(toSettlementRow(SETTLEMENTS[0])).toMatchObject({ amount: 1_026_000, direction: "payout" });
  });

  it("집기 렌털료도 순액이다", () => {
    expect(toSettlementRow(SETTLEMENTS[1])).toMatchObject({ amount: 67_500, direction: "payout" });
  });

  it("보증금은 돌려받는 돈으로 표시한다", () => {
    expect(toSettlementRow(SETTLEMENTS[2])).toMatchObject({
      amount: 114_000,
      direction: "refundable",
      isEscrowHeld: true,
    });
  });

  it("플랫폼 수수료는 gross를 쓴다 — net은 0이다", () => {
    // 플랫폼은 자기에게 이체하지 않으므로 net이 0이다. 그대로 그리면
    // "플랫폼이 0원을 가져간다"로 읽힌다.
    const row = toSettlementRow(SETTLEMENTS[3]);

    expect(row.amount).toBe(121_500);
    expect(row.amount).not.toBe(0);
    expect(row.direction).toBe("fee");
  });

  it("네 행이 서로 다른 방향을 갖는다", () => {
    // 형태만 같고 의미가 다르다 — 받을 돈 / 돌려받을 돈 / 떼인 돈.
    const directions = SETTLEMENTS.map((s) => toSettlementRow(s).direction);

    expect(new Set(directions).size).toBe(3);
  });
});

describe("summarizeSettlements", () => {
  it("Σnet + Σfee가 결제액과 같다", () => {
    // 백엔드 인수 조건과 같은 식이다.
    const summary = summarizeSettlements(SETTLEMENTS);

    expect(summary.accountedTotal).toBe(PAID_AMOUNT);
    expect(isBalanced(summary, PAID_AMOUNT)).toBe(true);
  });

  it("돌려받는 돈을 따로 합산한다", () => {
    expect(summarizeSettlements(SETTLEMENTS).refundableTotal).toBe(114_000);
  });

  it("1원이라도 새면 어긋난 것으로 판정한다", () => {
    // 합계를 숨기면 아무도 모른다 — 화면이 드러내야 한다.
    const broken = [...SETTLEMENTS];
    broken[0] = { ...broken[0], netAmount: broken[0].netAmount - 1 };

    expect(isBalanced(summarizeSettlements(broken), PAID_AMOUNT)).toBe(false);
  });

  it("빈 내역도 다루다 깨지지 않는다", () => {
    const summary = summarizeSettlements([]);

    expect(summary.rows).toEqual([]);
    expect(summary.accountedTotal).toBe(0);
    // 결제액이 있는데 내역이 비면 어긋난 것이다.
    expect(isBalanced(summary, PAID_AMOUNT)).toBe(false);
  });

  it("행 순서를 바꾸지 않는다 — 서버가 준 순서가 돈의 흐름 순서다", () => {
    expect(summarizeSettlements(SETTLEMENTS).rows.map((r) => r.type)).toEqual([
      "SPACE_RENT",
      "FIXTURE_RENTAL",
      "DEPOSIT",
      "PLATFORM_FEE",
    ]);
  });

  it("같은 유형이 여러 행이어도 합산된다 — 가구사는 공급사별로 갈린다", () => {
    const multi: Settlement[] = [
      ...SETTLEMENTS,
      { type: "FIXTURE_RENTAL", payeeId: 27, grossAmount: 50_000, feeAmount: 5_000, netAmount: 45_000, status: "PENDING" },
    ];

    expect(summarizeSettlements(multi).accountedTotal).toBe(PAID_AMOUNT + 50_000);
    expect(summarizeSettlements(multi).rows).toHaveLength(5);
  });
});
