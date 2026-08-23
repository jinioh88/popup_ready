import { Card } from "../../components/ui/Card";
import { StatusBadge } from "../../components/ui/StatusBadge";
import {
  isBalanced,
  summarizeSettlements,
  type Settlement,
  type SettlementRow,
  type SettlementType,
} from "../../lib/settlement/breakdown";

/**
 * 다자간 분할 정산 내역 (US-203, 스타일가이드 §8.D).
 *
 * **이 서비스에서 가장 설명하기 어려운 화면**이라 금액 흐름을 단계로 나눈다 —
 * 총 결제액이 들어와서 누구에게 얼마씩 나뉘는지, 그중 무엇이 돌아오는지.
 *
 * **네 행을 같은 모양으로 그리지 않는다.** 형태만 같고 의미가 다르다 —
 * 받을 돈 / 받을 돈 / **돌려받을** 돈 / **떼인** 돈. 같은 필드를 똑같이 그리면
 * `PLATFORM_FEE`의 `netAmount: 0`이 "플랫폼이 0원을 가져간다"로 읽힌다.
 * `LimitGauge`에서 두 축을 다른 모양으로 그린 것과 같은 판단이다.
 */

type SettlementBreakdownProps = {
  settlements: readonly Settlement[];
  /** 실제 결제된 금액. 정산 합계와 대조한다. */
  paidAmount: number;
};

export function SettlementBreakdown({ settlements, paidAmount }: SettlementBreakdownProps) {
  const summary = summarizeSettlements(settlements);
  const balanced = isBalanced(summary, paidAmount);

  return (
    <Card as="section" padding="lg" className="flex flex-col gap-4" aria-label="정산 내역">
      <div>
        <h2 className="text-heading">정산 내역</h2>
        <p className="mt-1 text-caption text-text-muted">
          결제하신 금액이 어디로 가는지 보여줍니다.
        </p>
      </div>

      {/* 1단계 — 들어온 돈 */}
      <div className="flex items-baseline justify-between border-b border-border pb-3">
        <span className="text-body-strong">총 결제 금액</span>
        <span className="text-title tabular-nums">{won(paidAmount)}</span>
      </div>

      {/* 2단계 — 나뉘는 곳 */}
      <ul className="flex flex-col gap-3">
        {summary.rows.map((row, index) => (
          <li key={`${row.type}-${index}`}>
            <Row row={row} />
          </li>
        ))}
      </ul>

      {/* 3단계 — 돌아오는 돈 */}
      {summary.refundableTotal > 0 ? (
        <p className="rounded-lg bg-primary-light p-3 text-caption">
          이 중 <span className="text-body-strong tabular-nums">{won(summary.refundableTotal)}</span>
          은 보증금입니다. 지금은 보관 중이며 퇴실 검수 후 돌려받습니다.
        </p>
      ) : null}

      {/*
        합계가 어긋나면 **숨기지 않고 드러낸다.** 1원이라도 새면 정산이 잘못된 것이고,
        화면이 감추면 아무도 모른다. 백엔드 인수 조건과 같은 식으로 검산한다.
      */}
      {balanced ? null : (
        <p role="alert" className="text-caption text-error">
          정산 합계({won(summary.accountedTotal)})가 결제 금액({won(paidAmount)})과 맞지 않습니다.
          고객센터로 문의해 주세요.
        </p>
      )}
    </Card>
  );
}

function Row({ row }: { row: SettlementRow }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-body">{TYPE_LABELS[row.type]}</span>
        <span className={`text-body-strong tabular-nums ${AMOUNT_TONE[row.direction]}`}>
          {won(row.amount)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* 상태를 색으로만 알리지 않는다 — 뱃지 안에 글자가 있다(§8 인수 조건). */}
        {row.isEscrowHeld ? (
          <StatusBadge tone="info">에스크로 보관 중</StatusBadge>
        ) : (
          <StatusBadge tone="neutral">{STATUS_LABELS[row.status]}</StatusBadge>
        )}
        <span className="text-caption text-text-muted">{TYPE_HINTS[row.type]}</span>
      </div>
    </div>
  );
}

/** `Record<SettlementType, …>`이라 백엔드가 유형을 늘리면 컴파일이 깨진다. */
const TYPE_LABELS: Record<SettlementType, string> = {
  SPACE_RENT: "공간 대여료",
  FIXTURE_RENTAL: "집기 렌털료",
  DEPOSIT: "보증금",
  PLATFORM_FEE: "플랫폼 수수료",
};

const STATUS_LABELS: Record<Settlement["status"], string> = {
  PENDING: "정산 대기",
  ESCROW_HELD: "에스크로 보관 중",
  APPROVED: "정산 승인",
  TRANSFERRED: "지급 완료",
};

/**
 * 돈이 **누구에게** 가는지 글자로 설명한다. 금액만으로는 받는 돈인지 떼이는 돈인지 알 수 없다.
 *
 * `direction`이 아니라 `type`으로 적는 이유: 공간 대여료와 집기 렌털료는 방향이 같지만
 * **수취인이 다르다**(건물주 / 가구사). 방향으로 뭉뚱그리면 둘 다 "건물주·가구사에게"가 되어
 * 어느 돈이 누구에게 가는지 알 수 없다.
 */
const TYPE_HINTS: Record<SettlementType, string> = {
  SPACE_RENT: "건물주에게 지급",
  FIXTURE_RENTAL: "가구사에게 지급",
  DEPOSIT: "퇴실 검수 후 환불",
  PLATFORM_FEE: "플랫폼 수수료로 차감",
};

const AMOUNT_TONE: Record<SettlementRow["direction"], string> = {
  payout: "",
  refundable: "text-info",
  fee: "text-text-muted",
};

function won(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}
