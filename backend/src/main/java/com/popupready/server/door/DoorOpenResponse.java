package com.popupready.server.door;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 도어 오픈 승인 결과(US-301, §2.2-A).
 *
 * <p><b>게이트는 서버다.</b> "예약 시작 10분 전부터"의 판정을 클라이언트 시계에 맡기지 않으며,
 * 시간창 밖이면 이 응답 대신 403 {@code DOOR_NOT_YET_OPENABLE}이 나간다.
 *
 * <p><b>발행은 모바일이 한다.</b> 백엔드는 MQTT 클라이언트를 갖지 않고 발행할 토픽과 페이로드만
 * 내려준다(§2.3 — CLAUDE.md의 모킹 구조 유지).
 *
 * <p><b>{@code statusTopic}도 서버가 내려준다</b>(2026-08-23 추가). {@code topic} 문자열에서
 * spaceId를 파싱해 상태 토픽을 만드는 것도 조립이며, §2.3의 "서버가 내려준 것을 그대로 쓴다"는
 * 발행 토픽에만 걸리는 규칙이 아니다.
 *
 * <p>⚠️ {@code payload}는 객체라 모바일이 재직렬화한다. <b>나중에 서명 검증이 붙으면 재직렬화가
 * 바이트를 바꿔 서명이 깨진다</b> — 그때 {@code payloadRaw: string}으로 원문을 함께 실어야 한다.
 * 이번 스코프는 아니다.
 */
@Schema(description = "도어 오픈 승인 결과")
public record DoorOpenResponse(
        @Schema(description = "도어 이벤트 ID. ack에 이 값을 쓴다", example = "123", requiredMode = REQUIRED) Long eventId,
        @Schema(description = "발행할 MQTT 토픽", example = "popupready/locks/1/command", requiredMode = REQUIRED)
                String topic,
        @Schema(
                        description = "상태 구독 토픽. 구독 실패는 개방 흐름을 막지 않는다(UI 편의일 뿐 개방의 필요조건이 아니다)",
                        example = "popupready/locks/1/status",
                        requiredMode = REQUIRED)
                String statusTopic,
        @Schema(description = "발행할 페이로드. 그대로 발행한다", requiredMode = REQUIRED) DoorCommandPayload payload,
        @Schema(description = "이벤트 상태. 승인 직후는 항상 AUTHORIZED다", requiredMode = REQUIRED) DoorEventStatus status) {}
