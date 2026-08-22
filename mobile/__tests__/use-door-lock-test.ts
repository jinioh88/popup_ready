import { act, renderHook } from "@testing-library/react-native";
import mqtt, { type MqttClient } from "mqtt";

import { useDoorLock } from "../src/hooks/useDoorLock";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: "192.168.45.92:8081" } },
}));

// RN 번들과 마찬가지로 default export만 노출한다 — named import에 의존하면 여기서도 깨져야 한다.
jest.mock("mqtt", () => ({ __esModule: true, default: { connect: jest.fn() } }));

type Listener = (...args: unknown[]) => void;

/** 이벤트를 손으로 흘려보낼 수 있는 최소 mqtt 클라이언트. */
function createFakeClient() {
  const listeners = new Map<string, Listener[]>();

  return {
    on: jest.fn((event: string, listener: Listener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    }),
    subscribe: jest.fn(),
    publish: jest.fn(),
    end: jest.fn(),
    emit(event: string, ...args: unknown[]) {
      (listeners.get(event) ?? []).forEach((listener) => listener(...args));
    },
  };
}

function mockConnect(client: ReturnType<typeof createFakeClient>) {
  jest.mocked(mqtt.connect).mockReturnValue(client as unknown as MqttClient);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("useDoorLock", () => {
  it("연결되면 예약 토픽을 구독한다", async () => {
    const client = createFakeClient();
    mockConnect(client);

    const { result } = await renderHook(() => useDoorLock("r-42"));
    await act(async () => client.emit("connect"));

    expect(result.current.status).toBe("connected");
    expect(client.subscribe).toHaveBeenCalledWith(
      "popupready/reservations/r-42/door",
      { qos: 1 },
      expect.any(Function),
    );
  });

  // 구독이 실패하면 상태는 "연결됨"인데 응답이 영영 오지 않는다.
  // 현장에서는 "눌렀는데 아무 일도 안 일어남"과 구분되지 않으므로 드러내야 한다.
  it("구독 실패를 삼키지 않고 화면에 드러낸다", async () => {
    const client = createFakeClient();
    mockConnect(client);

    const { result } = await renderHook(() => useDoorLock("r-42"));
    await act(async () => client.emit("connect"));

    const onSubscribed = client.subscribe.mock.calls[0][2];
    await act(async () => onSubscribed(new Error("not authorized")));

    expect(result.current.error).toContain("not authorized");
  });

  it("연결이 끊기면 connected로 남지 않고 error로 드러난다", async () => {
    // reconnectPeriod가 0이라 자동 복구가 없다. connected로 남으면 버튼이 살아 있고
    // publish는 전송되지 않은 채 큐에 쌓인다 — 현장에서 가장 비싼 실패 모드.
    const client = createFakeClient();
    mockConnect(client);

    const { result } = await renderHook(() => useDoorLock("r-42"));
    await act(async () => client.emit("connect"));
    await act(async () => client.emit("close"));

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBeTruthy();
  });

  it("연결 오류 메시지는 끊김 문구로 덮이지 않는다", async () => {
    // mqtt.js는 연결 실패 시 error에 이어 close를 낸다. 원인이 더 구체적이므로 error가 남아야 한다.
    const client = createFakeClient();
    mockConnect(client);

    const { result } = await renderHook(() => useDoorLock("r-42"));
    await act(async () => {
      client.emit("error", new Error("ECONNREFUSED"));
      client.emit("close");
    });

    expect(result.current.error).toBe("ECONNREFUSED");
  });

  it("열림 신호 발행이 실패하면 오류를 노출한다", async () => {
    const client = createFakeClient();
    client.publish.mockImplementation((...args: unknown[]) => {
      const callback = args[3] as (publishError?: Error) => void;
      callback(new Error("broker unreachable"));
    });
    mockConnect(client);

    const { result } = await renderHook(() => useDoorLock("r-42"));
    await act(async () => client.emit("connect"));
    await act(async () => result.current.unlock());

    expect(result.current.error).toContain("broker unreachable");
  });

  it("화면을 벗어나면 연결을 끊는다", async () => {
    const client = createFakeClient();
    mockConnect(client);

    const { unmount } = await renderHook(() => useDoorLock("r-42"));
    await unmount();

    expect(client.end).toHaveBeenCalled();
  });
});
