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
 */
@Schema(description = "도어 오픈 승인 결과")
public record DoorOpenResponse(
        @Schema(description = "도어 이벤트 ID. ack에 이 값을 쓴다", example = "123", requiredMode = REQUIRED) Long eventId,
        @Schema(description = "발행할 MQTT 토픽", example = "popupready/locks/1/command", requiredMode = REQUIRED)
                String topic,
        @Schema(description = "발행할 페이로드. 그대로 발행한다", requiredMode = REQUIRED) DoorCommandPayload payload,
        @Schema(description = "이벤트 상태. 승인 직후는 항상 AUTHORIZED다", requiredMode = REQUIRED) DoorEventStatus status) {}
