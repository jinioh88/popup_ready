package com.popupready.server.door;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/**
 * MQTT 발행 결과 보고(§2.3 ③단계).
 *
 * <p>이 단계가 있어야 "전송 기록"이 성립한다 — 승인(①)만으로는 발행 기록이 아니다.
 * publish 실패를 성공으로 위장하지 않기 위한 장치다.
 */
@Schema(description = "MQTT 발행 결과 보고")
public record DoorAckRequest(
        @Schema(description = "발행 성공 여부", example = "true") @NotNull(message = "success는 필수입니다") Boolean success) {}
