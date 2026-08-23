import type { MqttConnectionStatus } from "../src/hooks/useMqttConnection";
import { describeDoorLock, type DoorFlowState } from "../src/lib/doorlock/status";

const CONNECTIONS: MqttConnectionStatus[] = [
  "connecting",
  "connected",
  "disconnected",
  "unavailable",
];

const FLOWS: DoorFlowState[] = [
  "idle",
  "authorizing",
  "publishing",
  "acking",
  "opened",
  "notYetOpenable",
  "unrecorded",
  "failed",
];

/** 모든 조합. 문구가 한 곳에 모여 있으니 전수로 확인하는 편이 사람 눈보다 싸다. */
const ALL = CONNECTIONS.flatMap((connection) =>
  FLOWS.map((flow) => ({ connection, flow, view: describeDoorLock(connection, flow, 3) })),
);

describe("도어락 상태 문구", () => {
  // 스타일가이드 §8.C 인수 조건. 도어락은 실제 하드웨어가 아니라 MQTT 모킹이므로
  // 전송 방식을 말하는 문구를 쓰지 않는다.
  it.each(ALL)("$connection/$flow 문구에 전송 방식이 드러나지 않는다", ({ view }) => {
    const text = `${view.headline} ${view.detail}`;
    expect(text).not.toMatch(/블루투스|BLE|Bluetooth|bluetooth/);
    // MQTT·브로커·토픽 같은 구현 용어도 현장 운영자에게는 의미가 없다.
    expect(text).not.toMatch(/MQTT|브로커|토픽|publish/i);
  });

  it.each(ALL)("$connection/$flow 상태를 색 없이도 읽을 수 있다", ({ view }) => {
    // 색 단독 전달 금지 — headline 텍스트가 항상 있어야 한다.
    expect(view.headline.trim().length).toBeGreaterThan(0);
    expect(view.detail.trim().length).toBeGreaterThan(0);
  });

  it("연결이 끊긴 동안에는 슬라이드를 잠근다", () => {
    // 열어 두면 publish가 큐에 쌓여 조용히 사라진다.
    expect(describeDoorLock("disconnected", "idle").canSlide).toBe(false);
    expect(describeDoorLock("connecting", "idle").canSlide).toBe(false);
    expect(describeDoorLock("unavailable", "idle").canSlide).toBe(false);
    expect(describeDoorLock("connected", "idle").canSlide).toBe(true);
  });

  it("진행 중에는 중복 발동을 막는다", () => {
    for (const flow of ["authorizing", "publishing", "acking"] as DoorFlowState[]) {
      expect(describeDoorLock("connected", flow).canSlide).toBe(false);
    }
  });

  it("끊김 문구에 다음 재시도까지 남은 시간을 담는다", () => {
    expect(describeDoorLock("disconnected", "idle", 7).detail).toContain("7초");
    // 예약된 재시도가 없으면 초를 지어내지 않는다.
    expect(describeDoorLock("disconnected", "idle", null).detail).not.toMatch(/\d+초/);
  });

  it("발행됐지만 기록에 실패한 경우를 개방됨으로 뭉개지 않는다", () => {
    const unrecorded = describeDoorLock("connected", "unrecorded");
    const opened = describeDoorLock("connected", "opened");

    expect(unrecorded.headline).not.toBe(opened.headline);
    expect(unrecorded.tone).not.toBe("success");
  });

  it("열 수 없는 상태는 실패가 아니라 별도 상태로 말한다", () => {
    const notYet = describeDoorLock("connected", "notYetOpenable");

    expect(notYet.tone).toBe("warning");
    // 사용자 잘못이 아니라 아직 때가 아닌 것이므로 문구를 구분한다.
    expect(notYet.headline).not.toContain("실패");
  });

  it("열 수 없는 사유를 시간 하나로 단정하지 않는다", () => {
    // 서버는 시간창 밖과 미결제를 같은 코드(DOOR_NOT_YET_OPENABLE)로 준다.
    // "개방 시간이 아니다"라고만 말하면 미결제 예약에서 사용자가 시작 시각을 기다리는데,
    // 기다려도 열리지 않는다 — 화면이 거짓을 말하는 셈이다.
    const view = describeDoorLock("connected", "notYetOpenable");
    const text = `${view.headline} ${view.detail}`;

    expect(text).toContain("결제");
    expect(view.headline).not.toContain("시간");
  });
});
