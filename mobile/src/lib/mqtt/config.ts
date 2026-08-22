/** 브로커 WebSocket 포트 — infra/mqtt/mosquitto.conf의 `listener 9001 / protocol websockets`. */
export const MQTT_WS_PORT = 9001;

/**
 * 브로커 URL을 결정한다.
 *
 * 실기기에서 `localhost`는 기기 자신을 가리키므로 개발 머신의 LAN IP가 필요하다.
 * Expo dev 서버의 `hostUri`("192.168.0.10:8081")가 이미 그 주소이므로 호스트만 떼어 재사용한다.
 * 명시적 지정이 필요하면 `EXPO_PUBLIC_MQTT_URL`이 항상 우선한다.
 */
export function resolveBrokerUrl(hostUri?: string, explicitUrl?: string): string | null {
  if (explicitUrl) return explicitUrl;
  if (!hostUri) return null;

  const host = hostUri.split("/")[0].split(":")[0];
  if (!host) return null;

  return `ws://${host}:${MQTT_WS_PORT}`;
}
