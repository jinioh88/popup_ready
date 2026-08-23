import { describe, expect, it } from "vitest";

import { paymentFailure } from "./failureMessage";
import { ApiRequestError } from "../../lib/api/client";
import { ERROR_CODES } from "../../lib/api/error-codes";

function failWith(code: string, status = 400) {
  return paymentFailure(new ApiRequestError(status, code, "서버 문구"));
}

describe("paymentFailure — 두 종류의 503", () => {
  it("락 실패는 재시도로 풀린다", () => {
    const failure = failWith("LOCK_ACQUISITION_FAILED", 503);

    expect(failure.recovery).toBe("retry");
    expect(failure.causedByUser).toBe(false);
  });

  it("승인 여부 불명은 재시도 버튼을 주지 않는다", () => {
    // 버튼이 있으면 문구로 아무리 경고해도 눌리고, 그 클릭이 이중 결제다.
    const failure = failWith("PAYMENT_RESULT_UNKNOWN", 503);

    expect(failure.recovery).toBe("checkReservation");
    expect(failure.recovery).not.toBe("retry");
  });

  it("같은 503인데 안내가 완전히 다르다", () => {
    const lock = failWith("LOCK_ACQUISITION_FAILED", 503);
    const unknown = failWith("PAYMENT_RESULT_UNKNOWN", 503);

    // HTTP 상태로 분기했다면 둘이 같은 화면으로 갔을 것이다.
    expect(lock.title).not.toBe(unknown.title);
    expect(lock.recovery).not.toBe(unknown.recovery);
  });

  it("승인 여부 불명 문구에 '실패'라는 말을 쓰지 않는다", () => {
    // 실패했는지 아닌지를 모르는 것이 이 상태의 정의다.
    const failure = failWith("PAYMENT_RESULT_UNKNOWN", 503);

    expect(failure.title).not.toContain("실패");
    expect(failure.description).not.toContain("실패");
  });

  it("이중 청구 위험을 문구로 알린다", () => {
    expect(failWith("PAYMENT_RESULT_UNKNOWN", 503).description).toContain("이중");
  });
});

describe("paymentFailure — 해소 방법이 실제로 해소하는가", () => {
  it("기간 충돌은 기간을 고치라고 한다 — 집기 얘기를 하지 않는다", () => {
    // 집기 문제로 안내하면 아무리 집기를 빼도 해소되지 않는다.
    const failure = failWith("SPACE_ALREADY_BOOKED", 409);

    expect(failure.recovery).toBe("editPeriod");
    expect(failure.description).not.toContain("집기");
  });

  it("집기 품절은 배치를 고치라고 한다", () => {
    expect(failWith("FIXTURE_UNAVAILABLE", 409).recovery).toBe("editLayout");
  });

  it("전력 초과도 배치를 고치라고 한다", () => {
    expect(failWith("POWER_LIMIT_EXCEEDED", 400).recovery).toBe("editLayout");
  });

  it("금액 불일치는 재시도가 아니라 견적 재확인이다", () => {
    // 같은 금액으로 다시 눌러도 같은 결과다.
    const failure = failWith("PAYMENT_AMOUNT_MISMATCH", 400);

    expect(failure.recovery).toBe("checkReservation");
    expect(failure.recovery).not.toBe("retry");
  });

  it("이미 결제됨은 중복 청구가 아님을 먼저 말한다", () => {
    const failure = failWith("PAYMENT_ALREADY_COMPLETED", 409);

    expect(failure.description).toContain("중복");
    expect(failure.recovery).toBe("checkReservation");
  });

  it("PG 거절은 수단을 바꿔 재시도한다", () => {
    const failure = failWith("PAYMENT_DECLINED", 402);

    expect(failure.recovery).toBe("retry");
    expect(failure.causedByUser).toBe(true);
  });
});

describe("paymentFailure — 사용자를 탓하지 않아야 하는 실패", () => {
  it("락 경합·PG 장애·기간 선점은 사용자 잘못이 아니다", () => {
    for (const code of [
      "LOCK_ACQUISITION_FAILED",
      "PAYMENT_RESULT_UNKNOWN",
      "SPACE_ALREADY_BOOKED",
      "FIXTURE_UNAVAILABLE",
    ]) {
      expect(failWith(code, 503).causedByUser).toBe(false);
    }
  });
});

describe("paymentFailure — 모르는 실패", () => {
  it("계약에 없는 코드는 안전한 기본값으로 떨어진다", () => {
    const failure = paymentFailure(new ApiRequestError(500, "NOT_A_REAL_CODE", "서버 오류"));

    expect(failure.title).toBe("결제를 완료하지 못했습니다");
  });

  it("모르는 실패에 재시도 버튼을 주지 않는다", () => {
    // 미지의 실패가 PAYMENT_RESULT_UNKNOWN 계열이면 재시도가 곧 이중 결제다.
    // 실서버에서 실제로 본 500 INTERNAL_ERROR(소진된 orderId 재사용)가 이 경로로 온다.
    const failure = paymentFailure(new ApiRequestError(500, "INTERNAL_ERROR", "서버 오류"));

    expect(failure.recovery).toBe("checkReservation");
  });

  it("네트워크 오류도 결과를 모르는 상태로 다룬다", () => {
    // 요청이 서버에 닿았는지조차 모른다 — 승인됐을 수 있다.
    const failure = paymentFailure(new TypeError("Failed to fetch"));

    expect(failure.recovery).toBe("checkReservation");
    expect(failure.causedByUser).toBe(false);
  });

  it("모든 에러 코드가 안내를 갖는다 — 빈 화면이 나오지 않는다", () => {
    for (const code of ERROR_CODES) {
      const failure = failWith(code);

      expect(failure.title.length).toBeGreaterThan(0);
      expect(failure.description.length).toBeGreaterThan(0);
    }
  });
});
