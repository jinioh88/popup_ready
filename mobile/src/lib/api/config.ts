/** 백엔드 개발 서버 포트 — backend/src/main/resources/application.yml 기준. */
export const API_PORT = 8080;

/** 모든 엔드포인트에 붙는 prefix (지시서 §2.2). */
export const API_PREFIX = "/api/v1";

/**
 * API 베이스 URL을 결정한다.
 *
 * MQTT 브로커와 같은 이유로 `localhost`를 하드코딩하지 않는다 — 실기기에서 localhost는
 * 기기 자신이다. Expo dev 서버의 `hostUri`("192.168.0.10:8081")가 개발 머신 주소이므로
 * 호스트만 떼어 재사용한다. 명시적 지정은 `EXPO_PUBLIC_API_URL`이 항상 우선한다.
 *
 * 주소를 못 구하면 폴백하지 않고 null을 돌려 호출부가 오류로 드러내게 한다.
 */
export function resolveApiBaseUrl(hostUri?: string, explicitUrl?: string): string | null {
  if (explicitUrl) return `${stripTrailingSlash(explicitUrl)}${API_PREFIX}`;
  if (!hostUri) return null;

  const host = hostUri.split("/")[0].split(":")[0];
  if (!host) return null;

  return `http://${host}:${API_PORT}${API_PREFIX}`;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}
