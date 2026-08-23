import {
  RESERVATION_STATUS_LABEL,
  reservationStatusLabel,
  parseReservationId,
} from "../src/lib/api/reservations";

describe("예약 상태 문구", () => {
  // 계약(ReservationRequestResponse.status)의 enum 전체. 계약이 늘면 Record 타입이
  // 컴파일에서 먼저 깨지고, 이 목록이 그 사실을 사람에게도 드러낸다.
  const CONTRACT_STATUSES = [
    "DRAFT",
    "CONTRACT_PENDING",
    "CONTRACT_SIGNED",
    "PAYMENT_PENDING",
    "PAID",
    "CANCELLED",
  ];

  it("계약의 모든 상태에 문구가 있다", () => {
    expect(Object.keys(RESERVATION_STATUS_LABEL).sort()).toEqual([...CONTRACT_STATUSES].sort());
  });

  it("문구를 영문 enum 그대로 두지 않는다", () => {
    Object.entries(RESERVATION_STATUS_LABEL).forEach(([status, label]) => {
      expect(label).not.toBe(status);
      expect(label.trim().length).toBeGreaterThan(0);
    });
  });

  it("계약 밖 값이 오면 빈칸이 아니라 원문을 보여준다", () => {
    // 화면에서 상태가 사라지는 편이 영문이 뜨는 것보다 나쁘다.
    expect(reservationStatusLabel("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});

describe("parseReservationId", () => {
  it("정상 ID를 숫자로 바꾼다", () => {
    expect(parseReservationId("42")).toBe(42);
  });

  it("숫자가 아니거나 비정상이면 null이다", () => {
    // null이면 화면이 요청을 보내지 않는다 — 딥링크로 아무 문자열이나 들어올 수 있다.
    for (const bad of [undefined, "", "abc", "0", "-3", "1.5", "42abc"]) {
      expect(parseReservationId(bad)).toBeNull();
    }
  });
});
