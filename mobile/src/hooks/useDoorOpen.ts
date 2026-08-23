import Constants from "expo-constants";
import { useCallback, useState } from "react";

import { resolveApiBaseUrl } from "../lib/api/config";
import { ApiRequestError } from "../lib/api/client";
import { ackDoorEvent, requestDoorOpen } from "../lib/api/door";
import { describeDoorLock, type DoorFlowState } from "../lib/doorlock/status";
import { withTimeout } from "../lib/doorlock/with-timeout";
import { useMqttConnection } from "./useMqttConnection";

/**
 * 발행 콜백을 기다리는 한계. 넘으면 실패로 보고 ③으로 마감한다.
 *
 * 브로커가 응답하지 않을 때 흐름이 멈춘 채 남으면 승인 기록만 있고 발행 기록이 없다.
 */
const PUBLISH_TIMEOUT_MS = 5_000;

const NO_BASE_URL_MESSAGE = "API 주소를 확인할 수 없다. EXPO_PUBLIC_API_URL을 지정하라.";

/**
 * 무인 스마트락 체크인 (US-301, 지시서 §2.3의 3단계).
 *
 * ```
 * ① POST /reservation-requests/{id}/door-open  → 서버가 topic·payload를 내려준다
 * ② 받은 topic·payload를 그대로 MQTT publish   → 클라이언트가 조립하지 않는다
 * ③ POST /door-events/{eventId}/ack {success}  → DELIVERED / FAILED로 마감
 * ```
 *
 * **①이 성공하고 ③ 없이 끝나는 경로를 만들지 않는다.** ①만으로는 승인 기록일 뿐 발행
 * 기록이 아니며, 그 차이가 publish 실패를 성공으로 위장하지 않게 막는 장치다.
 *
 * **게이트는 서버다.** "시작 10분 전부터"를 클라이언트 시계로 판정하지 않는다 — 슬라이드는
 * 항상 시도할 수 있고, 시간창 밖이면 서버가 403 `DOOR_NOT_YET_OPENABLE`을 준다.
 */
export function useDoorOpen(reservationId: number) {
  const connection = useMqttConnection();
  // 훅이 매 렌더 새 객체를 돌려주므로 `connection`을 통째로 의존하면 `open`의 정체성이
  // 매 렌더 바뀐다. 그러면 슬라이드의 PanResponder가 제스처 도중에 다시 만들어져
  // 응답자가 끊길 수 있다. 안정적인(useCallback[]) 함수만 집어 쓴다.
  const { publish, subscribe } = connection;
  const [flow, setFlow] = useState<DoorFlowState>("idle");
  const [error, setError] = useState<string | null>(null);

  const baseUrl = resolveApiBaseUrl(Constants.expoConfig?.hostUri, process.env.EXPO_PUBLIC_API_URL);

  const open = useCallback(async () => {
    if (!baseUrl) {
      setFlow("failed");
      setError(NO_BASE_URL_MESSAGE);
      return;
    }

    setError(null);
    setFlow("authorizing");

    // ① 권한·시간창 검증. 여기서 막히면 발행은 시도조차 하지 않는다.
    let authorized;
    try {
      authorized = await requestDoorOpen(baseUrl, reservationId);
    } catch (authorizeError) {
      const notYet =
        authorizeError instanceof ApiRequestError &&
        authorizeError.code === "DOOR_NOT_YET_OPENABLE";
      setFlow(notYet ? "notYetOpenable" : "failed");
      setError(messageOf(authorizeError));
      return;
    }

    // 상태 구독은 UI 편의다 — 실패해도 개방 흐름을 막지 않는다(계약 §2.3).
    subscribe(authorized.statusTopic);

    // ② 받은 값을 그대로 발행한다.
    setFlow("publishing");
    let published = false;
    let publishFailure: string | null = null;
    try {
      await withTimeout(
        publish(authorized.topic, JSON.stringify(authorized.payload)),
        PUBLISH_TIMEOUT_MS,
      );
      published = true;
    } catch (publishError) {
      publishFailure = messageOf(publishError);
    }

    // ③ 성공이든 실패든 반드시 마감한다.
    setFlow("acking");
    try {
      await ackDoorEvent(baseUrl, authorized.eventId, published);
      setFlow(published ? "opened" : "failed");
      setError(publishFailure);
    } catch (ackError) {
      // 이미 마감된 이벤트는 실패가 아니다. 5초 타임아웃 뒤 늦게 도착한 발행 콜백이나
      // 더블 탭으로 ack가 두 번 나갈 수 있는데, 그때 사용자에게 오류를 보이면
      // 실제로는 열린 문을 안 열렸다고 말하게 된다.
      if (ackError instanceof ApiRequestError && ackError.code === "DOOR_EVENT_ALREADY_ACKED") {
        setFlow(published ? "opened" : "failed");
        setError(publishFailure);
        return;
      }

      // 발행은 됐는데 기록이 없는 상태다. opened로 뭉개면 "전송 기록"이 거짓이 된다.
      setFlow(published ? "unrecorded" : "failed");
      setError(publishFailure ?? messageOf(ackError));
    }
  }, [baseUrl, publish, subscribe, reservationId]);

  const view = describeDoorLock(connection.status, flow, connection.retryInSeconds);

  return {
    ...view,
    flow,
    error: error ?? connection.error,
    brokerUrl: connection.brokerUrl,
    retryInSeconds: connection.retryInSeconds,
    lastStatusMessage: connection.lastMessage,
    reconnectNow: connection.reconnectNow,
    open,
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "알 수 없는 오류가 발생했다.";
}
