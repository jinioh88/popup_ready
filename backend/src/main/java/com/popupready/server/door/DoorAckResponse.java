package com.popupready.server.door;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/** 마감된 도어 이벤트(§2.2-A). */
@Schema(description = "도어 이벤트 마감 결과")
public record DoorAckResponse(
        @Schema(description = "도어 이벤트 ID", example = "123", requiredMode = REQUIRED) Long eventId,
        @Schema(description = "마감 상태 — DELIVERED 또는 FAILED", requiredMode = REQUIRED) DoorEventStatus status,
        @Schema(description = "보고 접수 시각(UTC)", requiredMode = REQUIRED) Instant ackedAt) {}
