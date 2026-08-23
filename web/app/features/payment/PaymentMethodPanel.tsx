import { useState } from "react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Field } from "../../components/ui/Field";
import type { ReservationRequest } from "../../lib/schemas/api";

/**
 * 결제 수단 패널 (J-2).
 *
 * **토스 위젯이 들어갈 자리다(J-1).** 위젯은 클라이언트 키가 있어야 렌더되므로, 키가 없는
 * 동안에도 결제 경로 전체를 밟을 수 있게 **`paymentKey`를 만들어 내는 부분만 분리**해 둔다.
 * 위젯이 붙으면 이 패널의 입력 자리가 위젯으로 바뀌고, 바깥 흐름(`prepare`→`confirm`)은
 * 그대로다.
 *
 * 개발 중 목 PG는 `paymentKey` 접두로 결과를 가른다 — `DECLINE-`(402) · `TIMEOUT-`(503) ·
 * 그 외(승인). 성공 경로만 있는 결제 UI를 만들지 않으려면 이 셋을 다 밟아봐야 한다.
 */

type PaymentMethodPanelProps = {
  status: ReservationRequest["status"];
  isPending: boolean;
  onPay: (paymentKey: string) => void;
};

export function PaymentMethodPanel({ status, isPending, onPay }: PaymentMethodPanelProps) {
  const [paymentKey, setPaymentKey] = useState("");

  // 결제로 갈 수 없는 상태를 먼저 거른다 — 서버 문구가 상태를 정확히 설명하지 않는 경우가 있다.
  const blocked = BLOCKED_REASONS[status];

  if (blocked) {
    return (
      <Card padding="lg" className="flex flex-col gap-2">
        <h2 className="text-heading">{blocked.title}</h2>
        <p className="text-body text-text-muted">{blocked.description}</p>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div>
        <h2 className="text-heading">결제 수단</h2>
        <p className="mt-1 text-caption text-text-muted">
          결제사 위젯 연동 준비 중입니다. 개발 중에는 결제 키를 직접 입력해 승인 경로를
          확인합니다.
        </p>
      </div>

      <Field
        label="결제 키 (개발용)"
        help="DECLINE- 으로 시작하면 거절, TIMEOUT- 으로 시작하면 결과 불명으로 처리됩니다."
      >
        {(control) => (
          <input
            {...control}
            value={paymentKey}
            onChange={(event) => setPaymentKey(event.target.value)}
            placeholder="예: NORMAL-1"
          />
        )}
      </Field>

      <Button onClick={() => onPay(paymentKey)} disabled={isPending || paymentKey.trim() === ""}>
        {isPending ? "결제 처리 중…" : "결제하기"}
      </Button>
    </Card>
  );
}

/**
 * 결제할 수 없는 상태와 그 이유.
 *
 * `Record<ReservationStatus, …>`라 상태가 늘면 컴파일이 깨진다 — 새 상태가 조용히
 * "결제 가능"으로 떨어지면 사용자는 결제 버튼을 누른 뒤에야 서버 거절을 본다.
 */
const BLOCKED_REASONS: Record<
  ReservationRequest["status"],
  { title: string; description: string } | null
> = {
  DRAFT: {
    title: "계약이 아직 생성되지 않았습니다",
    description: "예약 상세에서 계약을 확인하고 서명해 주세요.",
  },
  CONTRACT_PENDING: {
    title: "서명이 완료되지 않았습니다",
    // 서버는 이 상태를 "계약 서명이 끝난 예약만 결제할 수 있습니다"로 알려주는데,
    // 그것만으로는 **누구의 서명이 남았는지** 알 수 없다.
    description: "양 당사자의 서명이 모두 끝나야 결제할 수 있습니다. 예약 상세에서 확인해 주세요.",
  },
  CONTRACT_SIGNED: null,
  PAYMENT_PENDING: null,
  PAID: {
    title: "이미 결제가 완료됐습니다",
    description: "이 예약은 결제가 끝났습니다. 중복으로 청구되지 않았습니다.",
  },
  CANCELLED: {
    title: "취소된 예약입니다",
    description: "취소된 예약은 결제할 수 없습니다.",
  },
};
