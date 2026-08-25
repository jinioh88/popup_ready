import { describe, expect, it } from "vitest";

import { allowsAnotherAttempt, paymentFailure } from "./failureMessage";
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

  it("소진된 orderId 재사용은 재시도가 아니라 상태 확인으로 보낸다", () => {
    // 이 코드가 왔다는 건 직전 시도의 결과를 모른다는 뜻이다 — 다시 결제하면
    // 그 모르는 결과 위에 한 번 더 청구할 수 있다.
    const failure = failWith("ORDER_ID_ALREADY_USED", 409);

    expect(failure.recovery).toBe("checkReservation");
    expect(failure.recovery).not.toBe("retry");
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

describe("allowsAnotherAttempt — 결제 수단을 계속 보여줘도 되는가", () => {
  it("직전 결과를 모르는 실패에서는 결제 수단을 치운다", () => {
    // **재시도 버튼을 없애는 것만으로는 부족하다** — 경고 바로 아래에 동작하는 결제 폼이
    // 남아 있으면 사용자는 그것을 누른다. 버튼만 없앤 보호는 보호가 아니다.
    for (const code of ["PAYMENT_RESULT_UNKNOWN", "ORDER_ID_ALREADY_USED"]) {
      expect(allowsAnotherAttempt(failWith(code, 503))).toBe(false);
    }
  });

  it("이미 결제된 예약에서도 결제 수단을 치운다", () => {
    expect(allowsAnotherAttempt(failWith("PAYMENT_ALREADY_COMPLETED", 409))).toBe(false);
  });

  it("모르는 실패에서도 치운다 — 안전한 기본값", () => {
    expect(allowsAnotherAttempt(paymentFailure(new ApiRequestError(500, "INTERNAL_ERROR", "")))).toBe(
      false,
    );
    expect(allowsAnotherAttempt(paymentFailure(new TypeError("Failed to fetch")))).toBe(false);
  });

  it("락 실패·PG 거절은 그 자리에서 다시 시도할 수 있다", () => {
    expect(allowsAnotherAttempt(failWith("LOCK_ACQUISITION_FAILED", 503))).toBe(true);
    expect(allowsAnotherAttempt(failWith("PAYMENT_DECLINED", 402))).toBe(true);
  });

  it("배치·기간을 고쳐야 하는 실패도 이 자리에서는 못 한다", () => {
    // 같은 조건으로 다시 눌러봐야 같은 실패다.
    expect(allowsAnotherAttempt(failWith("SPACE_ALREADY_BOOKED", 409))).toBe(false);
    expect(allowsAnotherAttempt(failWith("FIXTURE_UNAVAILABLE", 409))).toBe(false);
  });
});

describe("paymentFailure — 당사자가 아닌 사용자 (2026-08-25 인수 발견)", () => {
  it("prepare의 403 FORBIDDEN이 사유를 말한다", () => {
    // 인수 테스트에서 이 코드가 매핑에 없어 "결제를 완료하지 못했습니다"만 나왔고,
    // 사용자는 결제 키를 네 번 바꿔 넣었다 — 키는 서버에 닿지도 않았다.
    const failure = failWith("FORBIDDEN", 403);

    expect(failure.title).toContain("당사자가 아닙니다");
    expect(failure.description).toContain("브랜드 계정");
  });

  it("당사자가 아니면 이 화면에서 할 수 있는 일이 없다", () => {
    // 재시도도 배치 수정도 답이 아니다. 계정을 바꾸는 것은 이 화면 밖의 일이다.
    expect(failWith("FORBIDDEN", 403).recovery).toBe("none");
    expect(allowsAnotherAttempt(failWith("FORBIDDEN", 403))).toBe(false);
  });

  it("기본 문구로 떨어지지 않는다 — 그것이 이 결함의 얼굴이었다", () => {
    const forbidden = failWith("FORBIDDEN", 403);
    const unknown = failWith("SOME_CODE_THAT_IS_NOT_MAPPED", 500);

    expect(forbidden.title).not.toBe(unknown.title);
  });
});
