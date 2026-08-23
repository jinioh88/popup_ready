import type { components } from "../api/schema";

/**
 * 다자간 분할 정산 해석 (US-203, sprint2-web.md K-1).
 *
 * **네 행은 형태만 같고 의미가 전부 다르다** — 받을 돈 / 받을 돈 / **돌려받을** 돈 / **떼인** 돈.
 * 같은 필드를 네 행에 똑같이 그리면 화면이 거짓을 말한다. 특히 `PLATFORM_FEE`는
 * `netAmount`가 0인데(플랫폼은 자기에게 이체하지 않는다) 그걸 그대로 그리면
 * "플랫폼이 0원을 가져간다"로 읽힌다.
 *
 * 표시 필드는 PM이 확정했다(2026-08-23, 백엔드 확인):
 *   SPACE_RENT · FIXTURE_RENTAL → `netAmount`   (건물주·가구사가 받을 돈)
 *   DEPOSIT                     → `netAmount`   (돌려받을 돈, ESCROW_HELD 강조)
 *   PLATFORM_FEE                → `grossAmount` (수수료 합)
 */

export type Settlement = components["schemas"]["SettlementResponse"];
export type SettlementType = Settlement["type"];

/** 행 하나를 화면이 필요한 형태로 해석한 것. */
export type SettlementRow = {
  type: SettlementType;
  /** 이 행에서 실제로 보여줄 금액. type에 따라 gross이거나 net이다. */
  amount: number;
  /** 돈의 방향. 문구·색을 이걸로 고른다. */
  direction: "payout" | "refundable" | "fee";
  status: Settlement["status"];
  /** 보증금처럼 아직 묶여 있는 돈인가. */
  isEscrowHeld: boolean;
};

/**
 * type별 표시 규칙. **`Record<SettlementType, …>`이라 백엔드가 type을 늘리면 컴파일이 깨진다.**
 * 폴백을 두면 새 정산 유형이 조용히 잘못된 금액으로 렌더된다.
 */
const DISPLAY: Record<
  SettlementType,
  { field: "netAmount" | "grossAmount"; direction: SettlementRow["direction"] }
> = {
  SPACE_RENT: { field: "netAmount", direction: "payout" },
  FIXTURE_RENTAL: { field: "netAmount", direction: "payout" },
  DEPOSIT: { field: "netAmount", direction: "refundable" },
  PLATFORM_FEE: { field: "grossAmount", direction: "fee" },
};

export function toSettlementRow(settlement: Settlement): SettlementRow {
  const rule = DISPLAY[settlement.type];

  return {
    type: settlement.type,
    amount: settlement[rule.field],
    direction: rule.direction,
    status: settlement.status,
    isEscrowHeld: settlement.status === "ESCROW_HELD",
  };
}

export type SettlementSummary = {
  rows: SettlementRow[];
  /** `Σ(netAmount) + Σ(feeAmount)`. 결제 총액과 같아야 한다. */
  accountedTotal: number;
  /** 보증금 합 — "돌려받는 돈"으로 따로 보여준다. */
  refundableTotal: number;
};

/**
 * 정산 내역 요약.
 *
 * `accountedTotal`은 **백엔드 인수 조건(`Σnet + Σfee == payment.amount`)과 같은 식**이다.
 * 화면이 이 값을 결제액과 대조해, 어긋나면 **합계를 숨기지 말고 드러낸다** — 1원이라도 새면
 * 정산이 잘못된 것이고, 그걸 화면이 감추면 아무도 모른다.
 */
export function summarizeSettlements(settlements: readonly Settlement[]): SettlementSummary {
  const rows = settlements.map(toSettlementRow);

  return {
    rows,
    accountedTotal: settlements.reduce((sum, s) => sum + s.netAmount + s.feeAmount, 0),
    refundableTotal: rows
      .filter((row) => row.direction === "refundable")
      .reduce((sum, row) => sum + row.amount, 0),
  };
}

/** 정산 합계가 결제액과 맞는가. 어긋나면 화면이 경고해야 한다. */
export function isBalanced(summary: SettlementSummary, paidAmount: number): boolean {
  return summary.accountedTotal === paidAmount;
}
