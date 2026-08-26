import { describe, expect, it } from "vitest";

import { messageOf } from "./useCreateReservation";
import { ApiRequestError } from "../../lib/api/client";

function failWith(code: string, message = "서버 문구") {
  return messageOf(new ApiRequestError(409, code, message));
}

describe("messageOf — 사유가 아니라 다음 걸음을 말한다", () => {
  it("겹치는 기간은 다른 날짜를 고르라고 한다", () => {
    /*
     * 이 코드가 지금까지 결제 화면에서만 왔다. 그래서 사용자는 겹치는 기간으로 예약을 만들고
     * 서명을 두 번 한 뒤 결제 화면에서야 409를 봤다 — 인수 테스트에서 두 번 겪었다.
     * 백엔드가 054878b로 생성 시점에 거절하게 됐고, 웹은 그 답을 사람 말로 옮긴다.
     */
    const message = failWith("SPACE_ALREADY_BOOKED");

    expect(message).toContain("다른 날짜");
    // 서버 문구를 그대로 흘려보내지 않는다 — default로 떨어졌다는 뜻이 되기 때문이다.
    expect(message).not.toBe("서버 문구");
  });

  it("집기 품절과 기간 겹침을 다르게 안내한다", () => {
    // 집기 문제로 안내하면 아무리 집기를 빼도 해소되지 않는다.
    expect(failWith("SPACE_ALREADY_BOOKED")).not.toBe(failWith("FIXTURE_UNAVAILABLE"));
  });

  it("모르는 코드는 서버 문구를 그대로 쓴다", () => {
    // 지어내지 않는다 — 우리가 모르는 실패에 임의 문구를 붙이면 사실과 달라질 수 있다.
    expect(failWith("SOME_UNMAPPED_CODE", "서버가 준 설명")).toBe("서버가 준 설명");
  });

  it("네트워크 오류는 API 실패와 구분한다", () => {
    expect(messageOf(new TypeError("Failed to fetch"))).toContain("네트워크");
  });
});
