import { ApiRequestError } from "../../lib/api/client";
import type { ErrorCode } from "../../lib/api/error-codes";

/**
 * 결제 실패 → 사용자 안내 (US-201 웹 구간, sprint2-web.md J-2).
 *
 * **`error.code`로만 갈라야 한다. HTTP 상태로 갈라서는 안 된다.**
 * 503이 두 종류이고 뜻이 정반대이기 때문이다.
 *
 *   `LOCK_ACQUISITION_FAILED`  503 — 남이 잡은 락이 곧 풀린다. **재시도로 해결된다.**
 *   `PAYMENT_RESULT_UNKNOWN`   503 — 승인됐는지 **서버도 모른다.** 재시도는 이중 결제다.
 *
 * "503이면 재시도 안내"라는 지름길이 들어가기 딱 좋은 자리라 규칙으로 못박는다.
 *
 * `retry`가 갈라내는 것은 **"다시 눌러서 풀리는가"**다. 풀리지 않는 실패에 버튼을 주면
 * 사용자는 같은 실패를 반복하고, 이중 결제 위험이 있는 자리에서는 그 반복이 사고가 된다.
 */

/** 실패 후 사용자가 할 수 있는 일. 화면은 이 값으로 버튼을 고른다. */
export type PaymentRecovery =
  /** 결제를 처음부터 다시(`prepare`부터). `orderId`는 재사용되지 않는다. */
  | "retry"
  /** 배치를 고쳐야 한다 — 빌더로 보낸다. */
  | "editLayout"
  /** 기간을 고쳐야 한다 — 빌더로 보낸다. */
  | "editPeriod"
  /** 예약 상태를 확인해야 한다 — 예약 상세로 보낸다. */
  | "checkReservation"
  /** 사용자가 지금 할 수 있는 일이 없다. 버튼을 주지 않는다. */
  | "none";

export type PaymentFailure = {
  title: string;
  description: string;
  recovery: PaymentRecovery;
  /**
   * 사용자 입력·선택 때문에 생긴 실패인가.
   *
   * `false`면 문구에서 사용자를 탓하지 않는다 — 락 경합·PG 장애는 사용자가 한 일이 아니다.
   */
  causedByUser: boolean;
};

const FAILURES: Partial<Record<ErrorCode, PaymentFailure>> = {
  SPACE_ALREADY_BOOKED: {
    title: "이미 예약된 기간입니다",
    // 집기 문제로 안내하면 아무리 집기를 빼도 해소되지 않는다.
    description: "선택한 기간에 다른 예약이 확정됐습니다. 다른 날짜를 선택해 주세요.",
    recovery: "editPeriod",
    causedByUser: false,
  },
  FIXTURE_UNAVAILABLE: {
    title: "집기 수량이 부족합니다",
    description: "선택한 기간에 일부 집기가 품절됐습니다. 집기를 교체하거나 기간을 바꿔 주세요.",
    recovery: "editLayout",
    causedByUser: false,
  },
  POWER_LIMIT_EXCEEDED: {
    title: "허용 전력을 초과했습니다",
    description: "배치한 집기의 소비 전력이 상가 한도를 넘습니다. 집기를 줄여 주세요.",
    recovery: "editLayout",
    causedByUser: true,
  },
  PAYMENT_AMOUNT_MISMATCH: {
    title: "결제 금액이 견적과 다릅니다",
    // 같은 금액으로 다시 눌러도 같은 결과다 — 재시도가 아니라 견적을 다시 받아야 한다.
    description:
      "예약 정보가 변경돼 금액이 달라졌습니다. 예약 내용을 다시 확인한 뒤 결제해 주세요.",
    recovery: "checkReservation",
    causedByUser: false,
  },
  PAYMENT_ALREADY_COMPLETED: {
    title: "이미 결제가 완료됐습니다",
    // 중복 결제가 아니라는 것을 먼저 말한다 — 사용자의 첫 걱정이 그것이다.
    description: "이 예약은 결제가 끝났습니다. 중복으로 청구되지 않았습니다.",
    recovery: "checkReservation",
    causedByUser: false,
  },
  ORDER_ID_ALREADY_USED: {
    title: "이미 처리된 결제 요청입니다",
    // 이 코드가 왔다는 건 직전 시도의 결과를 화면이 모르고 있다는 뜻이다.
    // 다시 결제하게 하면 그 모르는 결과 위에 한 번 더 청구할 수 있다.
    description:
      "이 결제 요청은 이미 처리됐습니다. 예약 상세에서 결제 상태를 확인한 뒤 진행해 주세요.",
    recovery: "checkReservation",
    causedByUser: false,
  },
  PAYMENT_DECLINED: {
    title: "결제가 거절됐습니다",
    description: "카드사에서 결제를 승인하지 않았습니다. 다른 결제 수단으로 시도해 주세요.",
    recovery: "retry",
    causedByUser: true,
  },
  LOCK_ACQUISITION_FAILED: {
    title: "잠시 후 다시 시도해 주세요",
    // 사용자 잘못이 아니라는 것을 문구에 담는다. "실패"라는 말도 쓰지 않는다.
    description:
      "같은 공간을 동시에 예약하는 요청이 있어 처리하지 못했습니다. 잠시 후 다시 시도하면 진행됩니다.",
    recovery: "retry",
    causedByUser: false,
  },
  PAYMENT_RESULT_UNKNOWN: {
    // **"실패"라고 쓰지 않는다** — 실패했는지 아닌지를 모르는 것이 이 상태의 정의다.
    title: "결제 결과를 확인하는 중입니다",
    description:
      "결제사 응답이 지연돼 승인 여부를 아직 확인하지 못했습니다. 예약 상세에서 상태를 확인해 주세요. 확인 전에 다시 결제하면 이중으로 청구될 수 있습니다.",
    // 재시도 버튼을 주지 않는다. 버튼이 있으면 문구로 아무리 경고해도 눌린다.
    recovery: "checkReservation",
    causedByUser: false,
  },
  UNAUTHORIZED: {
    title: "로그인이 필요합니다",
    description: "세션이 만료됐습니다. 다시 로그인한 뒤 결제해 주세요.",
    recovery: "none",
    causedByUser: false,
  },
  NOT_CONTRACT_PARTY: {
    title: "이 예약의 당사자가 아닙니다",
    description: "본인의 예약만 결제할 수 있습니다.",
    recovery: "none",
    causedByUser: false,
  },
};

/**
 * 모르는 실패의 기본 안내.
 *
 * **재시도 버튼을 주지 않는다.** 무엇이 잘못됐는지 모르는 상태에서 결제를 다시 시도하게 하는
 * 것은, 그 미지의 실패가 `PAYMENT_RESULT_UNKNOWN` 계열일 때 이중 결제가 된다.
 */
const UNKNOWN_FAILURE: PaymentFailure = {
  title: "결제를 완료하지 못했습니다",
  description: "예약 상세에서 결제 상태를 확인해 주세요. 문제가 계속되면 고객센터로 문의해 주세요.",
  recovery: "checkReservation",
  causedByUser: false,
};

export function paymentFailure(error: unknown): PaymentFailure {
  if (!(error instanceof ApiRequestError)) {
    // 네트워크 오류 — 요청이 서버에 닿았는지조차 알 수 없다. 승인됐을 가능성이 있다.
    return {
      title: "네트워크 오류로 결제를 확인하지 못했습니다",
      description:
        "연결이 끊겨 결제 결과를 확인하지 못했습니다. 예약 상세에서 상태를 확인해 주세요.",
      recovery: "checkReservation",
      causedByUser: false,
    };
  }

  return (error.code !== "UNKNOWN" && FAILURES[error.code]) || UNKNOWN_FAILURE;
}

/**
 * 이 실패 뒤에 **같은 화면에서 결제를 다시 시도해도 되는가.**
 *
 * 화면은 이 값으로 결제 수단 패널의 노출을 정한다. 재시도 버튼을 없애는 것만으로는
 * 부족하다 — **결제 폼이 그대로 남아 있으면 버튼을 없앤 의미가 없다.** 경고 바로 아래에
 * 동작하는 결제 버튼이 있으면 사용자는 그것을 누른다.
 *
 * `PAYMENT_RESULT_UNKNOWN`·`ORDER_ID_ALREADY_USED`처럼 **직전 결과를 모르는** 상태에서
 * 한 번 더 시도하면 이중 청구가 된다. 그 상태에서는 결제 수단 자체를 치운다.
 */
export function allowsAnotherAttempt(failure: PaymentFailure): boolean {
  return failure.recovery === "retry";
}
