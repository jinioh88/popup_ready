import { ackDoorEvent, requestDoorOpen } from "../src/lib/api/door";
import { resetAuthClientState } from "../src/lib/api/authed-client";

jest.mock("../src/lib/auth/token-storage", () => ({
  readAccessToken: () => Promise.resolve("jwt-abc"),
  readRefreshToken: () => Promise.resolve("refresh-abc"),
  saveTokens: jest.fn(),
  clearTokens: jest.fn(),
}));

const BASE = "http://192.168.0.10:8080/api/v1";

const VALID_PAYLOAD = {
  action: "OPEN",
  eventId: 123,
  issuedAt: "2026-09-01T09:50:00Z",
  reservationId: 45,
};

const VALID_OPEN = {
  eventId: 123,
  payload: VALID_PAYLOAD,
  status: "AUTHORIZED",
  statusTopic: "popupready/locks/1/status",
  topic: "popupready/locks/1/command",
};

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function ok(data: unknown) {
  return jsonResponse({ data, error: null });
}

function fail(code: string, status: number) {
  return jsonResponse({ data: null, error: { code, message: `${code} 발생` } }, status);
}

beforeEach(() => {
  resetAuthClientState();
});

describe("requestDoorOpen", () => {
  it("계약대로인 응답을 파싱해 topic·payload를 돌려준다", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(ok(VALID_OPEN));

    await expect(requestDoorOpen(BASE, 45, { fetchImpl })).resolves.toEqual(VALID_OPEN);
    expect(fetchImpl.mock.calls[0][0]).toBe(`${BASE}/reservation-requests/45/door-open`);
    expect(fetchImpl.mock.calls[0][1].method).toBe("POST");
  });

  // 훼손된 topic을 그대로 발행하면 엉뚱한 공간의 도어락에 열림 신호가 간다.
  // 조용히 넘기는 것이 가장 비싼 실패다.
  it("규약을 벗어난 발행 토픽을 거른다", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(ok({ ...VALID_OPEN, topic: "attacker/locks/1/command" }));

    await expect(requestDoorOpen(BASE, 45, { fetchImpl })).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });

  it("와일드카드가 낀 발행 토픽을 거른다", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(ok({ ...VALID_OPEN, topic: "popupready/locks/+/command" }));

    await expect(requestDoorOpen(BASE, 45, { fetchImpl })).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });

  it("상태 토픽이 규약을 벗어나도 거른다", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(ok({ ...VALID_OPEN, statusTopic: "popupready/locks/1/command" }));

    await expect(requestDoorOpen(BASE, 45, { fetchImpl })).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });

  it("payload 필드가 빠지면 거른다", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      ok({
        ...VALID_OPEN,
        payload: { action: "OPEN", eventId: 123 },
      }),
    );

    await expect(requestDoorOpen(BASE, 45, { fetchImpl })).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });

  // 시간창 판정은 서버가 한다. 클라이언트 시계로 버튼을 잠그지 않으므로 이 코드가 권위다.
  it("시간창 밖이면 DOOR_NOT_YET_OPENABLE로 올라온다", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(fail("DOOR_NOT_YET_OPENABLE", 403));

    await expect(requestDoorOpen(BASE, 45, { fetchImpl })).rejects.toMatchObject({
      code: "DOOR_NOT_YET_OPENABLE",
    });
  });
});

describe("ackDoorEvent", () => {
  it("성공 보고는 DELIVERED로 마감된다", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        ok({ ackedAt: "2026-09-01T09:50:02Z", eventId: 123, status: "DELIVERED" }),
      );

    await expect(ackDoorEvent(BASE, 123, true, { fetchImpl })).resolves.toMatchObject({
      status: "DELIVERED",
    });
    expect(fetchImpl.mock.calls[0][0]).toBe(`${BASE}/door-events/123/ack`);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ success: true });
  });

  it("실패 보고를 그대로 싣는다", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(ok({ ackedAt: "2026-09-01T09:50:02Z", eventId: 123, status: "FAILED" }));

    await ackDoorEvent(BASE, 123, false, { fetchImpl });

    // publish 실패를 성공으로 위장하지 않기 위한 장치다. 값이 뒤집히면 기록이 거짓이 된다.
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ success: false });
  });
});
