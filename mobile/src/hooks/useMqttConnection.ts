import Constants from "expo-constants";
import mqtt, { type MqttClient } from "mqtt";
import { useCallback, useEffect, useRef, useState } from "react";

import { nextDelayMs } from "../lib/mqtt/backoff";
import { resolveBrokerUrl } from "../lib/mqtt/config";

/**
 * `unavailable`은 재시도로 풀리지 않는 상태다(브로커 주소를 못 구함) — `disconnected`와 달리
 * 기다려도 나아지지 않으므로 화면에서 다르게 말해야 한다.
 */
export type MqttConnectionStatus = "connecting" | "connected" | "disconnected" | "unavailable";

export type MqttMessage = { topic: string; payload: string };

const NO_BROKER_MESSAGE = "브로커 주소를 확인할 수 없다. EXPO_PUBLIC_MQTT_URL을 지정하라.";
const NOT_CONNECTED_MESSAGE = "브로커에 연결돼 있지 않다.";

/**
 * 브로커 연결 수명주기 — 연결·재연결·발행·구독만 안다. 도어 개방 흐름은 `useDoorOpen`이 쥔다.
 *
 * 주의: `import { connect } from "mqtt"`는 쓸 수 없다. RN 번들은 default export만 노출한다.
 */
export function useMqttConnection() {
  const clientRef = useRef<MqttClient | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  /** 구독해 둔 토픽. 재연결될 때마다 다시 걸어야 한다 — 세션이 새로 열리기 때문이다. */
  const topicsRef = useRef<Set<string>>(new Set());

  const [status, setStatus] = useState<MqttConnectionStatus>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<MqttMessage | null>(null);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [retryInSeconds, setRetryInSeconds] = useState<number | null>(null);

  const brokerUrl = resolveBrokerUrl(
    Constants.expoConfig?.hostUri,
    process.env.EXPO_PUBLIC_MQTT_URL,
  );

  useEffect(() => {
    if (!brokerUrl) {
      setStatus("unavailable");
      setError(NO_BROKER_MESSAGE);
      return;
    }

    // 언마운트 후 도착하는 이벤트로 상태를 건드리지 않는다.
    let disposed = false;

    const clearRetry = () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    };

    const scheduleRetry = () => {
      clearRetry();
      attemptRef.current += 1;
      const delay = nextDelayMs(attemptRef.current);
      setRetryAt(Date.now() + delay);
      retryTimerRef.current = setTimeout(() => {
        if (!disposed) open();
      }, delay);
    };

    /** 끊김을 숨기지 않는다 — 상태가 connected로 남으면 버튼이 살아 있고 발행은 사라진다. */
    const dropTo = (message: string) => {
      if (disposed) return;
      setStatus("disconnected");
      setError(message);
      scheduleRetry();
    };

    function open() {
      if (disposed) return;

      // 이전 클라이언트를 확실히 닫는다. 남겨두면 소켓과 리스너가 겹쳐 쌓인다.
      clientRef.current?.end(true);

      setStatus((prev) => (prev === "connected" ? prev : "connecting"));
      setRetryAt(null);

      const client = mqtt.connect(brokerUrl!, {
        clientId: `popupready-app-${Date.now()}`,
        // 자동 재연결은 고정 간격이라 백오프가 되지 않는다. 끄고 직접 스케줄링한다.
        reconnectPeriod: 0,
      });
      clientRef.current = client;

      client.on("connect", () => {
        if (disposed) return;
        attemptRef.current = 0;
        clearRetry();
        setStatus("connected");
        setError(null);
        setRetryAt(null);

        // 재연결이면 세션이 새로 열린 것이라 구독이 남아 있지 않다. 다시 건다.
        topicsRef.current.forEach((topic) => {
          client.subscribe(topic, { qos: 1 }, (subscribeError) => {
            // 구독 실패를 삼키면 상태는 "연결됨"인데 응답이 영원히 오지 않는다.
            if (!disposed && subscribeError) {
              setError(`토픽 구독 실패: ${subscribeError.message}`);
            }
          });
        });
      });

      client.on("message", (topic, payload) => {
        if (disposed) return;
        setLastMessage({ topic, payload: payload.toString() });
      });

      client.on("error", (e) => dropTo(e.message));
      client.on("close", () => dropTo("도어락 연결이 끊겼다. 다시 연결하는 중이다."));
    }

    open();

    return () => {
      disposed = true;
      clearRetry();
      clientRef.current?.end(true);
      clientRef.current = null;
    };
  }, [brokerUrl]);

  // 다음 재시도까지 남은 시간. 재시도가 예약돼 있을 때만 타이머를 돈다.
  useEffect(() => {
    if (retryAt === null) {
      setRetryInSeconds(null);
      return;
    }

    const tick = () => setRetryInSeconds(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [retryAt]);

  /** 기다리지 않고 지금 다시 붙는다(복구 UI의 "다시 연결"). */
  const reconnectNow = useCallback(() => {
    const client = clientRef.current;
    if (!client || client.connected) return;
    attemptRef.current = 0;
    client.reconnect();
    setStatus("connecting");
    setRetryAt(null);
  }, []);

  const subscribe = useCallback((topic: string) => {
    topicsRef.current.add(topic);
    const client = clientRef.current;
    if (!client?.connected) return;
    client.subscribe(topic, { qos: 1 });
  }, []);

  /**
   * 발행. **연결돼 있지 않으면 시도하지 않고 즉시 실패한다.**
   *
   * mqtt.js는 오프라인이면 콜백 없이 메시지를 큐에 쌓는다 — 그대로 두면 "보냈다"고 표시된 채
   * 아무 일도 일어나지 않고, 호출부는 성공도 실패도 받지 못해 영원히 매달린다.
   */
  const publish = useCallback(async (topic: string, payload: string): Promise<void> => {
    const client = clientRef.current;
    if (!client?.connected) throw new Error(NOT_CONNECTED_MESSAGE);

    await new Promise<void>((resolve, reject) => {
      client.publish(topic, payload, { qos: 1 }, (publishError) => {
        if (publishError) reject(publishError);
        else resolve();
      });
    });
  }, []);

  return {
    status,
    brokerUrl,
    error,
    lastMessage,
    retryInSeconds,
    reconnectNow,
    subscribe,
    publish,
  };
}
