import { resolveBrokerUrl } from "../src/lib/mqtt/config";
import { isCommandTopic, isStatusTopic } from "../src/lib/mqtt/topics";

describe("resolveBrokerUrl", () => {
  it("hostUri의 호스트를 9001 포트 ws URL로 바꾼다", () => {
    expect(resolveBrokerUrl("192.168.45.92:8081")).toBe("ws://192.168.45.92:9001");
  });

  it("hostUri에 경로가 붙어도 호스트만 취한다", () => {
    expect(resolveBrokerUrl("192.168.45.92:8081/_expo")).toBe("ws://192.168.45.92:9001");
  });

  it("명시적 URL이 hostUri보다 우선한다", () => {
    expect(resolveBrokerUrl("192.168.45.92:8081", "ws://10.0.0.5:9001")).toBe("ws://10.0.0.5:9001");
  });

  it("hostUri가 없으면 null을 반환한다", () => {
    // 실기기에서 localhost로 폴백하면 기기 자신을 가리켜 조용히 실패한다. 그래서 null로 드러낸다.
    expect(resolveBrokerUrl(undefined)).toBeNull();
  });
});

// 토픽은 서버가 내려준 것을 그대로 쓴다(§2.3 "발행 토픽은 어떤 경우에도 조립하지 않는다").
// 여기서 확인하는 것은 "만들기"가 아니라 "받은 값이 규약대로인가"다 — 훼손된 토픽을 그대로
// 발행하면 엉뚱한 공간의 도어락에 열림 신호가 간다.
describe("도어락 토픽 규약", () => {
  it("규약대로인 발행 토픽을 받아들인다", () => {
    expect(isCommandTopic("popupready/locks/1/command")).toBe(true);
    expect(isCommandTopic("popupready/locks/space-7/command")).toBe(true);
  });

  it("규약대로인 상태 토픽을 받아들인다", () => {
    expect(isStatusTopic("popupready/locks/1/status")).toBe(true);
  });

  it("접두사·꼬리가 다른 토픽을 거른다", () => {
    expect(isCommandTopic("popupready/locks/1/status")).toBe(false);
    expect(isCommandTopic("other/locks/1/command")).toBe(false);
    expect(isCommandTopic("popupready/locks/1/command/extra")).toBe(false);
    expect(isCommandTopic("popupready/locks//command")).toBe(false);
  });

  it("공간 자리에 경로 구분자가 끼어든 토픽을 거른다", () => {
    expect(isCommandTopic("popupready/locks/1/2/command")).toBe(false);
  });

  it("와일드카드를 거른다", () => {
    // `+`가 통과하면 "여러 도어락에 한 번에" 같은 값이 흘러든다. 상태 구독도 남의 공간까지 받는다.
    expect(isCommandTopic("popupready/locks/+/command")).toBe(false);
    expect(isCommandTopic("popupready/locks/#/command")).toBe(false);
    expect(isStatusTopic("popupready/locks/+/status")).toBe(false);
    expect(isStatusTopic("popupready/locks/#/status")).toBe(false);
  });
});
