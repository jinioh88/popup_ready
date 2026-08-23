import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useDoorOpen } from "../src/hooks/useDoorOpen";

/**
 * US-301 3단계 흐름 (지시서 §2.3).
 *
 * 연결 계층은 이미 `use-mqtt-connection-test`가 덮으므로 여기서는 mock으로 대체하고,
 * **①→②→③ 순서와 마감 보장**에 집중한다.
 */
const mockPublish = jest.fn();
const mockSubscribe = jest.fn();

let mockConnectionStatus = "connected";

jest.mock("../src/hooks/useMqttConnection", () => ({
  useMqttConnection: () => ({
    status: mockConnectionStatus,
    brokerUrl: "ws://192.168.0.10:9001",
    error: null,
    lastMessage: null,
    retryInSeconds: null,
    reconnectNow: jest.fn(),
    subscribe: mockSubscribe,
    publish: mockPublish,
  }),
}));

const mockRequestDoorOpen = jest.fn();
const mockAckDoorEvent = jest.fn();
jest.mock("../src/lib/api/door", () => ({
  requestDoorOpen: (...args: unknown[]) => mockRequestDoorOpen(...args),
  ackDoorEvent: (...args: unknown[]) => mockAckDoorEvent(...args),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: "192.168.0.10:8081" } },
}));

const AUTHORIZED = {
  eventId: 123,
  payload: {
    action: "OPEN",
    eventId: 123,
    issuedAt: "2026-09-01T09:50:00Z",
    reservationId: 45,
  },
  status: "AUTHORIZED",
  statusTopic: "popupready/locks/1/status",
  topic: "popupready/locks/1/command",
};

beforeEach(() => {
  jest.clearAllMocks();
  mockConnectionStatus = "connected";
  mockRequestDoorOpen.mockResolvedValue(AUTHORIZED);
  mockAckDoorEvent.mockResolvedValue({ eventId: 123, status: "DELIVERED", ackedAt: "now" });
  mockPublish.mockResolvedValue(undefined);
});

describe("useDoorOpen", () => {
  it("서버가 내려준 topic·payload를 그대로 발행한다", async () => {
    const { result } = await renderHook(() => useDoorOpen(45));
    await act(async () => result.current.open());

    // 클라이언트가 조립하지 않는다(§2.3 규범). 값이 바뀌면 여기서 깨져야 한다.
    expect(mockPublish).toHaveBeenCalledWith(
      "popupready/locks/1/command",
      JSON.stringify(AUTHORIZED.payload),
    );
    await waitFor(() => expect(result.current.flow).toBe("opened"));
  });

  it("① 승인 → ② 발행 → ③ 마감 순서로 진행한다", async () => {
    const order: string[] = [];
    mockRequestDoorOpen.mockImplementation(async () => {
      order.push("authorize");
      return AUTHORIZED;
    });
    mockPublish.mockImplementation(async () => {
      order.push("publish");
    });
    mockAckDoorEvent.mockImplementation(async () => {
      order.push("ack");
      return { eventId: 123, status: "DELIVERED", ackedAt: "now" };
    });

    const { result } = await renderHook(() => useDoorOpen(45));
    await act(async () => result.current.open());

    expect(order).toEqual(["authorize", "publish", "ack"]);
    expect(mockAckDoorEvent).toHaveBeenCalledWith(expect.any(String), 123, true);
  });

  it("상태 토픽을 구독한다", async () => {
    const { result } = await renderHook(() => useDoorOpen(45));
    await act(async () => result.current.open());

    expect(mockSubscribe).toHaveBeenCalledWith("popupready/locks/1/status");
  });

  // ①만 있으면 승인 기록일 뿐 발행 기록이 아니다. 이 마감이 US-301의 핵심 장치다.
  it("발행에 실패해도 ③으로 마감하고 실패를 보고한다", async () => {
    mockPublish.mockRejectedValue(new Error("연결돼 있지 않다."));

    const { result } = await renderHook(() => useDoorOpen(45));
    await act(async () => result.current.open());

    expect(mockAckDoorEvent).toHaveBeenCalledWith(expect.any(String), 123, false);
    await waitFor(() => expect(result.current.flow).toBe("failed"));
    // 실패를 성공으로 위장하지 않는다.
    expect(result.current.headline).toBe("전송 실패");
  });

  it("발행 응답이 없어도 타임아웃으로 마감한다", async () => {
    jest.useFakeTimers();
    // 콜백이 영영 오지 않는 브로커. 마감이 없으면 흐름이 멈춘 채 기록이 성립하지 않는다.
    mockPublish.mockImplementation(() => new Promise(() => {}));

    const { result } = await renderHook(() => useDoorOpen(45));
    let pending: Promise<void>;
    await act(async () => {
      pending = result.current.open();
    });
    await act(async () => {
      jest.advanceTimersByTime(5_000);
      await pending;
    });

    expect(mockAckDoorEvent).toHaveBeenCalledWith(expect.any(String), 123, false);
    jest.useRealTimers();
  });

  it("시간창 밖이면 발행하지 않고 별도 상태로 멈춘다", async () => {
    const { ApiRequestError } = jest.requireActual("../src/lib/api/client");
    mockRequestDoorOpen.mockRejectedValue(
      new ApiRequestError("DOOR_NOT_YET_OPENABLE", "아직 이르다", 403),
    );

    const { result } = await renderHook(() => useDoorOpen(45));
    await act(async () => result.current.open());

    await waitFor(() => expect(result.current.flow).toBe("notYetOpenable"));
    // 승인이 없으면 발행할 것도 마감할 것도 없다.
    expect(mockPublish).not.toHaveBeenCalled();
    expect(mockAckDoorEvent).not.toHaveBeenCalled();
  });

  it("발행은 됐는데 기록에 실패하면 개방됨으로 뭉개지 않는다", async () => {
    mockAckDoorEvent.mockRejectedValue(new Error("network down"));

    const { result } = await renderHook(() => useDoorOpen(45));
    await act(async () => result.current.open());

    await waitFor(() => expect(result.current.flow).toBe("unrecorded"));
    expect(result.current.tone).not.toBe("success");
  });

  // 5초 타임아웃 뒤 늦게 도착한 발행 콜백이나 더블 탭으로 ack가 두 번 나갈 수 있다.
  // 그때 오류를 보이면 실제로는 열린 문을 안 열렸다고 말하게 된다.
  it("이미 마감된 이벤트(409)는 실패로 보지 않는다", async () => {
    const { ApiRequestError } = jest.requireActual("../src/lib/api/client");
    mockAckDoorEvent.mockRejectedValue(
      new ApiRequestError("DOOR_EVENT_ALREADY_ACKED", "이미 마감됨", 409),
    );

    const { result } = await renderHook(() => useDoorOpen(45));
    await act(async () => result.current.open());

    await waitFor(() => expect(result.current.flow).toBe("opened"));
    expect(result.current.error).toBeNull();
  });

  it("발행 실패 후 409를 받으면 개방됨으로 뒤집지 않는다", async () => {
    const { ApiRequestError } = jest.requireActual("../src/lib/api/client");
    mockPublish.mockRejectedValue(new Error("연결돼 있지 않다."));
    mockAckDoorEvent.mockRejectedValue(
      new ApiRequestError("DOOR_EVENT_ALREADY_ACKED", "이미 마감됨", 409),
    );

    const { result } = await renderHook(() => useDoorOpen(45));
    await act(async () => result.current.open());

    // 마감이 이미 됐다는 것과 문이 열렸다는 것은 다른 말이다.
    await waitFor(() => expect(result.current.flow).toBe("failed"));
  });

  it("연결이 끊긴 동안에는 슬라이드가 잠긴다", async () => {
    mockConnectionStatus = "disconnected";

    const { result } = await renderHook(() => useDoorOpen(45));

    // 열어 두면 publish가 큐에 쌓여 조용히 사라진다.
    expect(result.current.canSlide).toBe(false);
  });
});
