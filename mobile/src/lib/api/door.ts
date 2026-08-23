import { z } from "zod";

import { authedRequest } from "./authed-client";
import { parseOrThrow } from "./parse";
import type { components } from "./schema";
import { COMMAND_TOPIC_PATTERN, STATUS_TOPIC_PATTERN } from "../mqtt/topics";

/**
 * 도어 오픈 (US-301, 지시서 §2.3).
 *
 * 흐름은 3단계이고 **게이트는 서버**다. "시작 10분 전부터"의 판정을 클라이언트 시계에
 * 맡기지 않는다 — 서버가 403 `DOOR_NOT_YET_OPENABLE`을 주는 것이 권위다.
 */

const doorEventStatusSchema = z.enum(["AUTHORIZED", "DELIVERED", "FAILED"]);

const doorCommandPayloadSchema = z.object({
  action: z.string().min(1),
  eventId: z.number(),
  issuedAt: z.string().min(1),
  reservationId: z.number(),
});

/**
 * 응답을 Zod로 굳히는 이유가 여기서 가장 크다.
 *
 * topic·payload는 **검증 없이 브로커로 나간다.** 훼손된 topic을 그대로 발행하면 엉뚱한
 * 공간의 도어락에 열림 신호가 갈 수 있다 — 형식 위반은 계약 위반으로 보고 발행 전에 끊는다.
 */
export const doorOpenResponseSchema = z.object({
  eventId: z.number(),
  payload: doorCommandPayloadSchema,
  status: doorEventStatusSchema,
  statusTopic: z.string().regex(STATUS_TOPIC_PATTERN),
  topic: z.string().regex(COMMAND_TOPIC_PATTERN),
});

export const doorAckResponseSchema = z.object({
  ackedAt: z.string().min(1),
  eventId: z.number(),
  status: doorEventStatusSchema,
});

export type DoorOpenResult = z.infer<typeof doorOpenResponseSchema>;
export type DoorAckResult = z.infer<typeof doorAckResponseSchema>;

/** 생성 타입과 Zod 스키마가 어긋나면 여기서 컴파일 에러가 난다. */
type _OpenCheck = DoorOpenResult extends components["schemas"]["DoorOpenResponse"] ? true : never;
const _openCheck: _OpenCheck = true;
void _openCheck;

type _AckCheck = DoorAckResult extends components["schemas"]["DoorAckResponse"] ? true : never;
const _ackCheck: _AckCheck = true;
void _ackCheck;

/** ① 권한·시간창 검증 → 발행할 topic·payload를 받는다. */
export async function requestDoorOpen(
  baseUrl: string,
  reservationId: number,
  options?: { fetchImpl?: typeof fetch },
): Promise<DoorOpenResult> {
  const data = await authedRequest(baseUrl, `/reservation-requests/${reservationId}/door-open`, {
    method: "POST",
    fetchImpl: options?.fetchImpl,
  });

  return parseOrThrow(doorOpenResponseSchema, data, "도어 오픈 응답");
}

/**
 * ③ 발행 결과 보고 → DELIVERED / FAILED로 마감.
 *
 * **이 단계가 있어야 "전송 기록"이 성립한다.** ①만으로는 승인 기록일 뿐 발행 기록이 아니며,
 * 그 차이가 publish 실패를 성공으로 위장하지 않게 막는다.
 */
export async function ackDoorEvent(
  baseUrl: string,
  eventId: number,
  success: boolean,
  options?: { fetchImpl?: typeof fetch },
): Promise<DoorAckResult> {
  const data = await authedRequest(baseUrl, `/door-events/${eventId}/ack`, {
    method: "POST",
    body: { success },
    fetchImpl: options?.fetchImpl,
  });

  return parseOrThrow(doorAckResponseSchema, data, "도어 마감 응답");
}
