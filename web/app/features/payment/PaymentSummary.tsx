import { Card } from "../../components/ui/Card";
import { StatusBadge } from "../../components/ui/StatusBadge";
import type { ReservationRequest } from "../../lib/schemas/api";

/**
 * 결제 금액 요약 (J-2).
 *
 * **금액의 원장은 서버가 보관한 견적 스냅샷이다**(§2.2-E). 이 화면은 재계산하지 않는다 —
 * 빌더의 실시간 견적은 표시용 미리보기였고, 계약·결제 단계부터는 스냅샷만 참조한다.
 */
export function PaymentSummary({ reservation }: { reservation: ReservationRequest }) {
  const { estimate } = reservation;

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-heading">결제 금액</h2>
        <StatusBadge tone={reservation.status === "PAID" ? "success" : "info"}>
          {STATUS_LABELS[reservation.status]}
        </StatusBadge>
      </div>

      <dl className="flex flex-col gap-1 text-body tabular-nums">
        <Row label={`공간 대여료 (${estimate.days}일)`} value={estimate.spaceRentTotal} />
        <Row label="집기 렌털료" value={estimate.fixtureRentalTotal} />
        {/* 보증금은 '내는 돈'이 아니라 '맡기는 돈'이다 — 합계에 섞어 두면 그 사실이 사라진다. */}
        <Row label="보증금 (퇴실 후 환불)" value={estimate.deposit} />
        <div className="mt-2 border-t border-border pt-2">
          <Row label="총 결제 금액" value={estimate.totalAmount} strong />
        </div>
      </dl>
    </Card>
  );
}

/**
 * 상태 → 한글 문구. **`Record<ReservationStatus, string>`이라 상태가 늘면 컴파일이 깨진다.**
 * 폴백을 두면 새 상태가 조용히 영문 enum으로 노출된다(모바일에서 실제로 있었던 일).
 */
const STATUS_LABELS: Record<ReservationRequest["status"], string> = {
  DRAFT: "작성 중",
  CONTRACT_PENDING: "계약 서명 대기",
  CONTRACT_SIGNED: "결제 대기",
  PAYMENT_PENDING: "결제 확인 중",
  PAID: "결제 완료",
  CANCELLED: "취소됨",
};

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className={strong ? "text-body-strong" : "text-text-muted"}>{label}</dt>
      <dd className={strong ? "text-body-strong" : undefined}>
        {value.toLocaleString("ko-KR")}원
      </dd>
    </div>
  );
}
