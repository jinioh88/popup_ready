/**
 * 브로커 연결 상태.
 *
 * 훅(`useMqttConnection`)이 아니라 여기에 둔다 — `src/lib`은 React·훅에 의존하지 않는다는
 * 규칙 때문이다(CLAUDE.md 「파일 규율」). `lib/doorlock/status.ts`가 이 타입을 쓰는데,
 * 훅에서 가져오면 타입만이라도 의존 방향이 뒤집힌다.
 *
 * `unavailable`은 재시도로 풀리지 않는 상태다(브로커 주소를 못 구함) — `disconnected`와 달리
 * 기다려도 나아지지 않으므로 화면에서 다르게 말해야 한다.
 */
export type MqttConnectionStatus = "connecting" | "connected" | "disconnected" | "unavailable";
