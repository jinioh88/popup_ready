import { useParams } from "react-router";

import { Card } from "../components/ui/Card";
import { PaymentFailureCard } from "../features/payment/PaymentFailureCard";
import { PaymentSummary } from "../features/payment/PaymentSummary";
import { PaymentMethodPanel } from "../features/payment/PaymentMethodPanel";
import { allowsAnotherAttempt, paymentFailure } from "../features/payment/failureMessage";
import { usePayReservation, useReservation } from "../features/payment/queries";

export function meta() {
  return [{ title: "결제 · PopupReady" }];
}

/**
 * 결제 화면 (US-201 웹 구간). 이 모듈은 조립만 한다 — 실패 해석은 `failureMessage`,
 * 순서 규약은 `usePayReservation`이 갖는다.
 *
 * 진입 전제가 둘 있다(2026-08-23 실서버 확인).
 *   ① `prepare`는 **양측 서명 완료**를 요구한다 — 브랜드만 서명했으면 결제로 갈 수 없다.
 *   ② 이미 `PAID`면 결제할 것이 없다. 서버는 이때 `prepare`에서 "계약 서명이 끝난 예약만
 *      결제할 수 있습니다"라는 **사실과 다른 문구**를 주므로, 화면이 먼저 상태를 보고 막는다.
 */
export default function PaymentRoute() {
  const { reservationId } = useParams();
  const numericId = Number(reservationId);

  const reservationQuery = useReservation(numericId);
  const payment = usePayReservation(numericId);

  if (reservationQuery.isPending) {
    return <Notice>예약 정보를 불러오는 중…</Notice>;
  }

  if (reservationQuery.isError || !reservationQuery.data) {
    return <Notice tone="error">예약 정보를 불러오지 못했습니다.</Notice>;
  }

  const reservation = reservationQuery.data;
  const failure = payment.isError ? paymentFailure(payment.error) : null;

  /**
   * 결제 수단을 계속 보여줘도 되는가.
   *
   * **실패 카드에서 재시도 버튼을 빼는 것만으로는 부족하다** — 경고 바로 아래에 동작하는
   * 결제 폼이 남아 있으면 사용자는 그것을 누른다. 직전 결과를 모르는 실패에서는
   * 결제 수단 자체를 치운다.
   */
  const canPayHere = !payment.isSuccess && (failure === null || allowsAnotherAttempt(failure));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-6">
      <header>
        <h1 className="text-display">결제</h1>
        <p className="mt-2 text-caption text-text-muted">
          배치 확정 시점의 견적으로 결제합니다. 금액은 다시 계산되지 않습니다.
        </p>
      </header>

      <PaymentSummary reservation={reservation} />

      {failure ? (
        <PaymentFailureCard
          failure={failure}
          reservationId={numericId}
          spaceId={reservation.spaceId}
        />
      ) : null}

      {payment.isSuccess ? <PaymentResult confirm={payment.data} /> : null}

      {canPayHere ? (
        <PaymentMethodPanel
          status={reservation.status}
          isPending={payment.isPending}
          onPay={(paymentKey) => payment.mutate({ paymentKey })}
        />
      ) : null}
    </main>
  );
}

/** 승인 결과. 정산 내역(K-1)은 이 응답이 이미 들고 있다. */
function PaymentResult({ confirm }: { confirm: { amount: number; approvedAt: string } }) {
  return (
    <Card padding="lg" className="flex flex-col gap-2">
      <h2 className="text-title text-success">결제가 완료됐습니다</h2>
      <p className="text-body tabular-nums">
        {confirm.amount.toLocaleString("ko-KR")}원이 결제됐습니다.
      </p>
      <p className="text-caption text-text-muted">
        보증금은 별도로 보관되며 퇴실 검수 후 환불됩니다.
      </p>
    </Card>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <main className="px-6 py-6">
      <p className={`text-body ${tone === "error" ? "text-error" : "text-text-muted"}`}>
        {children}
      </p>
    </main>
  );
}
