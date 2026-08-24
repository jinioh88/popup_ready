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
  /**
   * 직전 시도의 결과를 이 화면이 모르는가 (§8.5).
   *
   * **판정은 라우트가 한다** — 이 패널은 예약 상태만 알고, "이번 세션에서 무슨 일이
   * 있었는지"는 모른다. `PAYMENT_PENDING`은 *위젯을 닫고 돌아온* 경우와 *직전 결과가
   * 불명인* 경우 둘 다이며 둘을 가르는 정보가 여기 없다.
   */
  priorAttemptUnknown?: boolean;
  onPay: (paymentKey: string) => void;
};

export function PaymentMethodPanel({
  status,
  isPending,
  priorAttemptUnknown = false,
  onPay,
}: PaymentMethodPanelProps) {
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

      {/*
        직전 결과를 모르는 채 결제 화면에 다시 들어온 경우다(§8.5). **폼을 치우지 않는다** —
        `PAYMENT_PENDING`은 위젯을 닫고 돌아온 정상 경로이기도 해서(백엔드 `PaymentService`가
        이 상태의 `prepare`를 일부러 허용한다) 막으면 정상 사용자가 결제를 못 한다.
        치우는 대신 **무엇을 모르는지 말한다.**

        **"실패"라고 쓰지 않는다** — 실패했는지 아닌지를 모르는 것이 이 상태의 정의다
        (지시서 §3 · `PAYMENT_RESULT_UNKNOWN` 문구와 같은 결).
      */}
      {priorAttemptUnknown ? (
        <p role="alert" className="rounded-lg bg-warning/15 p-3 text-caption text-text">
          <span className="text-body-strong">직전 결제 결과가 확인되지 않았습니다.</span> 예약
          상세에서 상태를 확인해 주세요. 확인 전에 다시 결제하면 이중으로 청구될 수 있습니다.
        </p>
      ) : null}

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
