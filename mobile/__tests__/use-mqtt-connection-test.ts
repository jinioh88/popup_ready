import { act, renderHook } from "@testing-library/react-native";
import mqtt, { type MqttClient } from "mqtt";

import { useMqttConnection } from "../src/hooks/useMqttConnection";
import { BASE_DELAY_MS, nextDelayMs } from "../src/lib/mqtt/backoff";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: "192.168.45.92:8081" } },
}));

// RN 번들과 마찬가지로 default export만 노출한다 — named import에 의존하면 여기서도 깨져야 한다.
jest.mock("mqtt", () => ({ __esModule: true, default: { connect: jest.fn() } }));

type Listener = (...args: unknown[]) => void;

/**
 * 이벤트를 손으로 흘려보낼 수 있는 최소 mqtt 클라이언트.
 *
 * **`end()`가 "close"를 발행한다** — 실물 mqtt.js가 그렇게 동작한다(end → _cleanUp →
 * 스트림 파괴 → close). 이걸 흉내 내지 않으면 "옛 클라이언트를 닫으며 재연결이 한 번 더
 * 예약되는" 버그가 테스트를 그대로 통과한다(실제로 그랬다).
 */
function createFakeClient() {
  const listeners = new Map<string, Listener[]>();
  const self = {
    connected: false,
    on: jest.fn((event: string, listener: Listener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    }),
    removeAllListeners: jest.fn(() => {
      listeners.clear();
    }),
    subscribe: jest.fn(),
    publish: jest.fn(),
    reconnect: jest.fn(),
    end: jest.fn(() => {
      self.connected = false;
      self.emit("close");
    }),
    emit(event: string, ...args: unknown[]) {
      (listeners.get(event) ?? []).forEach((listener) => listener(...args));
    },
  };
  return self;
}

type FakeClient = ReturnType<typeof createFakeClient>;

function mockConnect(...clients: FakeClient[]) {
  const connect = jest.mocked(mqtt.connect);
  connect.mockReset();
  clients.forEach((client) => connect.mockReturnValueOnce(client as unknown as MqttClient));
  // 목록을 다 쓰면 마지막 것을 계속 돌려준다.
  connect.mockReturnValue(clients[clients.length - 1] as unknown as MqttClient);
}

/** 연결 성공을 흘려보낸다. */
async function connectOk(client: FakeClient) {
  client.connected = true;
  await act(async () => client.emit("connect"));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useMqttConnection", () => {
  it("연결되면 connected가 되고 브로커 주소를 hostUri에서 만든다", async () => {
    const client = createFakeClient();
    mockConnect(client);

    const { result } = await renderHook(() => useMqttConnection());
    await connectOk(client);

    expect(result.current.status).toBe("connected");
    expect(result.current.brokerUrl).toBe("ws://192.168.45.92:9001");
  });

  it("끊기면 숨기지 않고 disconnected로 드러낸다", async () => {
    const client = createFakeClient();
    mockConnect(client);

    const { result } = await renderHook(() => useMqttConnection());
    await connectOk(client);

    client.connected = false;
    await act(async () => client.emit("close"));

    // connected로 남으면 버튼이 살아 있고 발행은 큐에 쌓여 조용히 사라진다.
    expect(result.current.status).toBe("disconnected");
    expect(result.current.error).toContain("연결이 끊겼다");
  });

  it("끊기면 백오프 지연 뒤에 스스로 다시 붙는다", async () => {
    const first = createFakeClient();
    const second = createFakeClient();
    mockConnect(first, second);

    const { result } = await renderHook(() => useMqttConnection());
    await connectOk(first);
    expect(mqtt.connect).toHaveBeenCalledTimes(1);

    first.connected = false;
    await act(async () => first.emit("close"));

    // 지연 전에는 다시 붙지 않는다 — 곧바로 재시도하면 폭주한다.
    expect(mqtt.connect).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(BASE_DELAY_MS);
    });
    expect(mqtt.connect).toHaveBeenCalledTimes(2);

    await connectOk(second);
    expect(result.current.status).toBe("connected");
  });

  it("재연결되면 걸어둔 구독을 다시 건다", async () => {
    const first = createFakeClient();
    const second = createFakeClient();
    mockConnect(first, second);

    const { result } = await renderHook(() => useMqttConnection());
    await connectOk(first);

    await act(async () => result.current.subscribe("popupready/locks/1/status"));
    expect(first.subscribe).toHaveBeenCalled();

    first.connected = false;
    await act(async () => first.emit("close"));
    await act(async () => {
      jest.advanceTimersByTime(BASE_DELAY_MS);
    });
    await connectOk(second);

    // 세션이 새로 열리면 구독은 남아 있지 않다. 다시 걸지 않으면 상태 메시지가 영영 안 온다.
    expect(second.subscribe).toHaveBeenCalledWith(
      "popupready/locks/1/status",
      { qos: 1 },
      expect.any(Function),
    );
  });

  it("연결이 끊긴 채로는 publish를 시도조차 하지 않는다", async () => {
    const client = createFakeClient();
    mockConnect(client);

    const { result } = await renderHook(() => useMqttConnection());
    await connectOk(client);
    client.connected = false;
    await act(async () => client.emit("close"));

    // mqtt.js는 오프라인이면 콜백 없이 큐에 쌓는다 — 호출부가 성공도 실패도 못 받고 매달린다.
    await expect(result.current.publish("t", "{}")).rejects.toThrow("연결돼 있지 않다");
    expect(client.publish).not.toHaveBeenCalled();
  });

  it("발행 실패를 삼키지 않고 올린다", async () => {
    const client = createFakeClient();
    mockConnect(client);
    client.publish.mockImplementation(
      (_t: string, _p: string, _o: unknown, cb: (e?: Error) => void) =>
        cb(new Error("broker full")),
    );

    const { result } = await renderHook(() => useMqttConnection());
    await connectOk(client);

    await expect(result.current.publish("t", "{}")).rejects.toThrow("broker full");
  });

  it("브로커 주소를 못 구하면 재시도로 풀리지 않는 상태로 드러낸다", async () => {
    jest.mocked(mqtt.connect).mockClear();
    const constants = jest.requireMock("expo-constants") as { default: { expoConfig: unknown } };
    const saved = constants.default.expoConfig;
    constants.default.expoConfig = {};

    const { result } = await renderHook(() => useMqttConnection());

    // 폴백해서 localhost로 붙으면 실기기에서 기기 자신을 가리킨다 — 조용한 실패가 더 비싸다.
    expect(result.current.status).toBe("unavailable");
    expect(mqtt.connect).not.toHaveBeenCalled();

    constants.default.expoConfig = saved;
  });

  // 옛 클라이언트를 닫으면 그쪽 close 핸들러가 살아 있는 한 dropTo→scheduleRetry를 탄다.
  // 타이머 개수로는 안 드러난다 — scheduleRetry가 먼저 clearRetry를 하므로 예약은 하나로
  // 유지된다. 드러나는 것은 **attempt가 한 번 더 오르는 것**이고, 그러면 백오프가 설계보다
  // 빨리 길어져 현장에서 복구가 늦어진다. 지터를 고정해 그 차이를 딱 짚는다.
  it("재연결하며 옛 클라이언트를 닫아도 백오프 단계가 건너뛰지 않는다", async () => {
    jest.spyOn(Math, "random").mockReturnValue(0); // 지연 = 계산값의 정확히 절반
    const first = createFakeClient();
    const second = createFakeClient();
    const third = createFakeClient();
    mockConnect(first, second, third);

    const { result } = await renderHook(() => useMqttConnection());
    await connectOk(first);

    // 1차 끊김 → attempt 1 → 500ms
    first.connected = false;
    await act(async () => first.emit("close"));
    await act(async () => {
      jest.advanceTimersByTime(nextDelayMs(1, () => 0));
    });
    expect(mqtt.connect).toHaveBeenCalledTimes(2);

    // 2차 끊김 → attempt 2 → 1000ms여야 한다.
    // 옛 클라이언트의 close를 그대로 맞았다면 attempt가 3이 되어 2000ms를 기다린다.
    await act(async () => second.emit("close"));
    await act(async () => {
      jest.advanceTimersByTime(nextDelayMs(2, () => 0));
    });
    expect(mqtt.connect).toHaveBeenCalledTimes(3);

    jest.spyOn(Math, "random").mockRestore();
    void result;
  });

  it("언마운트하면 클라이언트를 닫고 재시도 타이머를 지운다", async () => {
    const client = createFakeClient();
    mockConnect(client);

    const { result, unmount } = await renderHook(() => useMqttConnection());
    await connectOk(client);

    client.connected = false;
    await act(async () => client.emit("close"));
    // RNTL v14는 unmount도 비동기다. await 없이 쓰면 정리(cleanup)가 뒤로 밀려
    // 예약된 재시도가 먼저 발화하고, 테스트가 제품 버그처럼 보이는 실패를 낸다.
    await unmount();

    const callsAfterUnmount = jest.mocked(mqtt.connect).mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(jest.mocked(mqtt.connect).mock.calls.length).toBe(callsAfterUnmount);
    expect(client.end).toHaveBeenCalled();
    void result;
  });
});
