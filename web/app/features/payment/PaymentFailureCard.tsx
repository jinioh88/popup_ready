import { Link } from "react-router";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { StatusBadge } from "../../components/ui/StatusBadge";
import type { PaymentFailure } from "./failureMessage";

/**
 * 결제 실패 안내 (J-2).
 *
 * **여기에는 재시도 버튼이 없다.** 다시 시도해도 되는 실패라면 아래 결제 수단 패널이 그대로
 * 남아 있고 그것이 재시도 경로다 — 버튼을 따로 두면 같은 일을 하는 것이 둘이 된다.
 * 다시 시도하면 안 되는 실패에서는 **패널 자체가 치워진다**(`allowsAnotherAttempt`).
 *
 * 여기 버튼은 **이 화면을 벗어나는 길**만 제공한다. 결제 화면에 갇히면 사용자는
 * 새로고침·뒤로가기로 빠져나가고, 그 과정에서 결제를 다시 시도하게 된다.
 */

type PaymentFailureCardProps = {
  failure: PaymentFailure;
  reservationId: number;
  spaceId?: number;
};

export function PaymentFailureCard({
  failure,
  reservationId,
  spaceId,
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

        {failure.recovery === "retry" ? (
          <p className="w-full text-caption text-text-muted">
            아래 결제 수단에서 다시 시도할 수 있습니다.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
