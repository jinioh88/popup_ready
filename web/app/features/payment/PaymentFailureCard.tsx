import { Link } from "react-router";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { StatusBadge } from "../../components/ui/StatusBadge";
import type { PaymentFailure } from "./failureMessage";

/**
 * 결제 실패 안내 (J-2).
 *
 * **버튼은 `recovery`가 정한다.** 화면이 임의로 "다시 시도" 버튼을 붙이지 않는다 —
 * `PAYMENT_RESULT_UNKNOWN`처럼 재시도가 이중 결제가 되는 실패가 있고, 그 판단은
 * `failureMessage.ts`가 코드별로 이미 내렸다. 여기서 뒤집으면 그 판단이 무의미해진다.
 */

type PaymentFailureCardProps = {
  failure: PaymentFailure;
  reservationId: number;
  spaceId?: number;
  /** 결제를 처음부터(`prepare`부터) 다시 시작한다. */
  onRetry: () => void;
  isRetrying?: boolean;
};

export function PaymentFailureCard({
  failure,
  reservationId,
  spaceId,
  onRetry,
  isRetrying,
}: PaymentFailureCardProps) {
  return (
    <Card padding="lg" className="flex flex-col gap-4" role="alert">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={failure.causedByUser ? "warning" : "info"}>
          {failure.causedByUser ? "확인 필요" : "처리 중단"}
        </StatusBadge>
        <h2 className="text-title">{failure.title}</h2>
      </div>

      <p className="text-body text-text-muted">{failure.description}</p>

      <div className="flex flex-wrap gap-2">
        {failure.recovery === "retry" ? (
          <Button onClick={onRetry} disabled={isRetrying}>
            {isRetrying ? "다시 시도하는 중…" : "다시 결제하기"}
          </Button>
        ) : null}

        {failure.recovery === "checkReservation" ? (
          <Button as={Link} to={`/reservations/${reservationId}/contract`}>
            예약 상세 확인
          </Button>
        ) : null}

        {(failure.recovery === "editLayout" || failure.recovery === "editPeriod") && spaceId ? (
          <Button as={Link} to={`/spaces/${spaceId}/builder`}>
            {failure.recovery === "editPeriod" ? "기간 다시 선택" : "배치 수정"}
          </Button>
        ) : null}

        {/*
          어떤 실패든 예약 상세로는 갈 수 있어야 한다 — 결제 화면에 갇히면 사용자는
          새로고침이나 뒤로가기로 빠져나가고, 그 과정에서 결제를 다시 시도하게 된다.
        */}
        {failure.recovery !== "checkReservation" ? (
          <Button as={Link} variant="secondary" to={`/reservations/${reservationId}/contract`}>
            예약 상세로
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
