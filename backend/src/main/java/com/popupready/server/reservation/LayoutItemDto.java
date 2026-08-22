package com.popupready.server.reservation;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * 배치된 집기 1개(스프린트 문서 §2.3). 좌표 단위는 픽셀이 아니라 <b>그리드 셀</b>이며
 * 좌상단 기준 0-base다.
 *
 * <p>rotation이 90 또는 270이면 점유 폭·깊이가 스왑된다. 여기서는 범위만 보고,
 * 90 배수 여부·그리드 범위 초과·겹침 판정은 레이아웃 검증 순수 클래스(T4-1)가 맡는다.
 */
@Schema(description = "배치된 집기")
public record LayoutItemDto(
        @Schema(description = "집기 ID", example = "3") @NotNull(message = "fixtureId는 필수입니다") Long fixtureId,
        @Schema(description = "좌상단 기준 열 좌표(0-base)", example = "4")
                @NotNull(message = "col은 필수입니다")
                @PositiveOrZero(message = "col은 0 이상이어야 합니다")
                Integer col,
        @Schema(description = "좌상단 기준 행 좌표(0-base)", example = "2")
                @NotNull(message = "row는 필수입니다")
                @PositiveOrZero(message = "row는 0 이상이어야 합니다")
                Integer row,
        @Schema(description = "회전각. 0 | 90 | 180 | 270", example = "90", allowableValues = {"0", "90", "180", "270"})
                @NotNull(message = "rotation은 필수입니다")
                @PositiveOrZero(message = "rotation은 0 이상이어야 합니다")
                @Max(value = 270, message = "rotation은 270 이하여야 합니다")
                Integer rotation) {}
