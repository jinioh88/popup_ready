package com.popupready.server.reservation;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 견적 내역. 합계만 주면 웹이 근거를 보여줄 수 없으므로 항목을 쪼개 내려보낸다.
 *
 * <p>계산식(스프린트 문서 §4): 일수 × (공간 대여료 + Σ집기 렌털료) + 보증금.
 */
@Schema(description = "견적 내역")
public record EstimateResponse(
        @Schema(description = "대여 일수", example = "14", requiredMode = REQUIRED) int days,
        @Schema(description = "공간 대여료 합계(원)", example = "6300000", requiredMode = REQUIRED)
                long spaceRentTotal,
        @Schema(description = "집기 렌털료 합계(원)", example = "420000", requiredMode = REQUIRED)
                long fixtureRentalTotal,
        @Schema(
                        description = "보증금(원). 일시사용 요건상 하향 설계된다",
                        example = "672000",
                        requiredMode = REQUIRED)
                long deposit,
        @Schema(description = "총 견적(원)", example = "7392000", requiredMode = REQUIRED) long totalAmount) {}
