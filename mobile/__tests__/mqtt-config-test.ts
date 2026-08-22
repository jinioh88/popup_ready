import { resolveBrokerUrl } from "../src/lib/mqtt/config";
import { buildUnlockCommand, doorLockTopic } from "../src/lib/mqtt/topics";

describe("resolveBrokerUrl", () => {
  it("hostUri의 호스트를 9001 포트 ws URL로 바꾼다", () => {
    expect(resolveBrokerUrl("192.168.45.92:8081")).toBe("ws://192.168.45.92:9001");
  });

  it("hostUri에 경로가 붙어도 호스트만 취한다", () => {
    expect(resolveBrokerUrl("192.168.45.92:8081/_expo")).toBe("ws://192.168.45.92:9001");
  });

  it("명시적 URL이 hostUri보다 우선한다", () => {
    expect(resolveBrokerUrl("192.168.45.92:8081", "ws://10.0.0.5:9001")).toBe("ws://10.0.0.5:9001");
  });

  it("hostUri가 없으면 null을 반환한다", () => {
    // 실기기에서 localhost로 폴백하면 기기 자신을 가리켜 조용히 실패한다. 그래서 null로 드러낸다.
    expect(resolveBrokerUrl(undefined)).toBeNull();
  });
});

describe("도어락 토픽·페이로드", () => {
  it("예약별 토픽을 만든다", () => {
    expect(doorLockTopic("r-42")).toBe("popupready/reservations/r-42/door");
  });

  it("열림 명령에 예약 ID와 요청 시각을 담는다", () => {
    const command = buildUnlockCommand("r-42", new Date("2026-08-22T09:00:00.000Z"));

    expect(command).toEqual({
      action: "unlock",
      reservationId: "r-42",
      requestedAt: "2026-08-22T09:00:00.000Z",
    });
  });
});
