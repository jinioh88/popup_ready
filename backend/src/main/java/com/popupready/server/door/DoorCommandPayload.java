package com.popupready.server.door;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * MQTT로 발행할 페이로드(§2.3). <b>서버가 조립해 내려주며 클라이언트가 만들지 않는다</b> —
 * 모바일은 받은 그대로 발행한다.
 */
@Schema(description = "MQTT 발행 페이로드")
public record DoorCommandPayload(
        @Schema(description = "도어 이벤트 ID", example = "123", requiredMode = REQUIRED) Long eventId,
        @Schema(description = "예약 요청 ID", example = "45", requiredMode = REQUIRED) Long reservationId,
        @Schema(description = "명령", example = "OPEN", requiredMode = REQUIRED) String action,
        @Schema(description = "발급 시각(UTC)", requiredMode = REQUIRED) Instant issuedAt) {}
