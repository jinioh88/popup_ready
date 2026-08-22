import Constants from "expo-constants";
import mqtt, { type MqttClient } from "mqtt";
import { useCallback, useEffect, useRef, useState } from "react";

import { resolveBrokerUrl } from "../lib/mqtt/config";
import { buildUnlockCommand, doorLockTopic } from "../lib/mqtt/topics";

export type DoorLockStatus = "idle" | "connecting" | "connected" | "error";

const DISCONNECTED_MESSAGE = "브로커 연결이 끊겼다. 화면을 다시 열어 재연결하라.";

/**
 * 도어락 모킹(US-301) — mqtt.js로 로컬 Mosquitto에 가상 열림 신호를 publish하고,
 * 같은 토픽을 구독해 브로커를 실제로 왕복했는지 확인한다.
 *
 * 주의: `import { connect } from "mqtt"`는 쓸 수 없다. RN 번들은 default export만 노출한다.
 */
export function useDoorLock(reservationId: string) {
  const clientRef = useRef<MqttClient | null>(null);
  const [status, setStatus] = useState<DoorLockStatus>("idle");
  const [lastEcho, setLastEcho] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const brokerUrl = resolveBrokerUrl(
    Constants.expoConfig?.hostUri,
    process.env.EXPO_PUBLIC_MQTT_URL,
  );
  const topic = doorLockTopic(reservationId);

  useEffect(() => {
    if (!brokerUrl) {
      setStatus("error");
      setError("브로커 주소를 확인할 수 없다. EXPO_PUBLIC_MQTT_URL을 지정하라.");
      return;
    }

    // 언마운트 후 도착하는 이벤트로 상태를 건드리지 않는다.
    let disposed = false;

    setStatus("connecting");
    const client = mqtt.connect(brokerUrl, {
      clientId: `popupready-app-${reservationId}-${Date.now()}`,
      // 자동 재연결은 끈 상태다(백오프 재연결은 Sprint 2). 그동안 끊김은 숨기지 않고
      // 아래 "close" 핸들러로 드러낸다.
      reconnectPeriod: 0,
    });
    clientRef.current = client;

    client.on("connect", () => {
      if (disposed) return;
      setStatus("connected");
      setError(null);
      // 구독 실패를 삼키면 상태는 "연결됨"인데 응답이 영원히 오지 않는다 —
      // 현장에서는 "눌렀는데 아무 일도 안 일어남"과 구분되지 않는다.
      client.subscribe(topic, { qos: 1 }, (subscribeError) => {
        if (disposed || !subscribeError) return;
        setError(`토픽 구독 실패: ${subscribeError.message}`);
      });
    });
    client.on("message", (_topic, payload) => {
      if (disposed) return;
      setLastEcho(payload.toString());
    });
    client.on("error", (e) => {
      if (disposed) return;
      setStatus("error");
      setError(e.message);
    });
    // reconnectPeriod가 0이라 한 번 끊기면 복구되지 않는다. 표시를 connected로 남겨두면
    // 버튼이 살아 있고, publish는 전송되지 않은 채 큐에 쌓여 조용히 사라진다.
    client.on("close", () => {
      if (disposed) return;
      setStatus("error");
      setError((prev) => prev ?? DISCONNECTED_MESSAGE);
    });

    return () => {
      disposed = true;
      clientRef.current = null;
      client.end(true);
    };
  }, [brokerUrl, reservationId, topic]);

  const unlock = useCallback(() => {
    const client = clientRef.current;
    if (!client || status !== "connected") return;

    const command = buildUnlockCommand(reservationId, new Date());
    client.publish(topic, JSON.stringify(command), { qos: 1 }, (publishError) => {
      // 발행 실패를 삼키면 현장에서는 "눌렀는데 아무 일도 안 일어남"으로만 보인다.
      if (publishError) setError(`열림 신호 발행 실패: ${publishError.message}`);
    });
  }, [reservationId, status, topic]);

  return { status, brokerUrl, topic, lastEcho, error, unlock };
}
