/**
 * 도어락 토픽 규약 (지시서 §2.3). 실제 IoT 하드웨어가 아니라 MQTT 모킹이다(US-301).
 *
 * **토픽을 만들지 않는다.** 발행할 토픽·페이로드는 서버가 door-open 응답으로 내려주며,
 * 클라이언트는 그대로 발행한다("발행 토픽은 어떤 경우에도 조립하지 않는다" — §2.3 규범).
 * 여기 남은 것은 **받은 값이 규약대로인지 확인하는 패턴**뿐이다 — 훼손된 토픽을 그대로
 * 발행하면 엉뚱한 공간의 도어락에 신호가 갈 수 있다.
 *
 * 공간 자리에 **MQTT 와일드카드(`+` `#`)를 허용하지 않는다.** 브로커가 발행 시 거절하기는
 * 하지만, 여기서 먼저 끊어야 "여러 도어락에 한 번에" 같은 값이 애초에 흘러들지 않는다.
 * 상태 토픽도 같다 — 와일드카드 구독은 남의 공간 상태까지 받아 온다.
 */
const SPACE_SEGMENT = "[A-Za-z0-9_-]+";

export const COMMAND_TOPIC_PATTERN = new RegExp(`^popupready/locks/${SPACE_SEGMENT}/command$`);
export const STATUS_TOPIC_PATTERN = new RegExp(`^popupready/locks/${SPACE_SEGMENT}/status$`);

export function isCommandTopic(topic: string): boolean {
  return COMMAND_TOPIC_PATTERN.test(topic);
}

export function isStatusTopic(topic: string): boolean {
  return STATUS_TOPIC_PATTERN.test(topic);
}
