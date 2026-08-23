import type { MqttConnectionStatus } from "../../hooks/useMqttConnection";

/**
 * 도어락 상태 → 화면 문구 (스타일가이드 §8.C — 인수 조건).
 *
 * **'블루투스'·'BLE'를 쓰지 않는다.** 실제 하드웨어가 아니라 MQTT 모킹이므로, 전송 방식과
 * 무관한 표현만 쓴다. 문구를 여기 모아 두는 이유가 그것이다 — 화면에 흩어 두면 금지어가
 * 다시 새는 것을 사람 눈으로 막아야 한다. `doorlock-status-test`가 전수로 확인한다.
 *
 * **색만으로 상태를 전하지 않는다.** `tone`은 색을 고르는 데 쓰이지만 `headline`이 항상 함께
 * 나가야 한다.
 */
export type DoorFlowState =
  | "idle"
  | "authorizing"
  | "publishing"
  | "acking"
  | "opened"
  | "notYetOpenable"
  | "unrecorded"
  | "failed";

export type DoorTone = "neutral" | "progress" | "success" | "warning" | "danger";

export type DoorLockView = {
  headline: string;
  detail: string;
  tone: DoorTone;
  /** 슬라이드를 열어 둘지. 연결이 끊겼거나 진행 중이면 잠근다. */
  canSlide: boolean;
};

/** 흐름이 진행 중인 동안은 연결 문구보다 흐름 문구가 우선한다. */
const IN_FLIGHT: DoorFlowState[] = ["authorizing", "publishing", "acking"];

export function describeDoorLock(
  connection: MqttConnectionStatus,
  flow: DoorFlowState,
  retryInSeconds: number | null = null,
): DoorLockView {
  if (IN_FLIGHT.includes(flow)) return inFlightView(flow);

  const terminal = terminalView(flow, connection);
  if (terminal) return terminal;

  return connectionView(connection, retryInSeconds);
}

function inFlightView(flow: DoorFlowState): DoorLockView {
  switch (flow) {
    case "authorizing":
      return {
        headline: "개방 권한 확인 중",
        detail: "서버에 개방 권한을 확인하고 있다.",
        tone: "progress",
        canSlide: false,
      };
    case "publishing":
      return {
        headline: "개방 신호 전송 중",
        detail: "도어락에 열림 신호를 보내고 있다.",
        tone: "progress",
        canSlide: false,
      };
    default:
      return {
        headline: "전송 결과 기록 중",
        detail: "개방 기록을 서버에 남기고 있다.",
        tone: "progress",
        canSlide: false,
      };
  }
}

function terminalView(flow: DoorFlowState, connection: MqttConnectionStatus): DoorLockView | null {
  switch (flow) {
    case "opened":
      return {
        headline: "개방됨",
        detail: "문이 열렸다. 기록이 남았다.",
        tone: "success",
        canSlide: connection === "connected",
      };
    case "notYetOpenable":
      return {
        headline: "아직 개방 시간이 아님",
        detail: "예약 시작 10분 전부터 열 수 있다. 개방 가능 시각은 서버가 판정한다.",
        tone: "warning",
        canSlide: connection === "connected",
      };
    case "unrecorded":
      return {
        headline: "개방됨 · 기록 실패",
        detail: "열림 신호는 보냈지만 서버에 기록하지 못했다. 다시 시도하라.",
        tone: "warning",
        canSlide: connection === "connected",
      };
    case "failed":
      return {
        headline: "전송 실패",
        detail: "열림 신호를 보내지 못했다. 다시 시도하라.",
        tone: "danger",
        canSlide: connection === "connected",
      };
    default:
      return null;
  }
}

function connectionView(
  connection: MqttConnectionStatus,
  retryInSeconds: number | null,
): DoorLockView {
  switch (connection) {
    case "connected":
      return { headline: "연결됨", detail: "밀어서 문을 연다.", tone: "neutral", canSlide: true };
    case "connecting":
      return {
        headline: "도어락 연결 중",
        detail: "잠시 기다린다.",
        tone: "progress",
        canSlide: false,
      };
    case "disconnected":
      return {
        headline: "연결 끊김",
        detail:
          retryInSeconds === null
            ? "다시 연결하는 중이다."
            : `${retryInSeconds}초 후 다시 연결한다.`,
        tone: "danger",
        canSlide: false,
      };
    default:
      return {
        headline: "도어락에 연결할 수 없음",
        detail: "연결 주소를 확인할 수 없다. 기다려도 복구되지 않는다.",
        tone: "danger",
        canSlide: false,
      };
  }
}
