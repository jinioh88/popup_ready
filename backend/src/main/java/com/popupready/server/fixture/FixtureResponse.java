package com.popupready.server.fixture;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 빌더 라이브러리 항목. widthMm·depthMm는 그리드 점유 셀 계산의 입력이고
 * (점유 셀 = ceil(widthMm / cellSizeMm) × ceil(depthMm / cellSizeMm), 스프린트 문서 §2.3),
 * powerWatt는 Sprint 2의 전력 합산 가드에 쓰인다. 비전기 집기는 0이다.
 */
@Schema(description = "모듈러 집기")
public record FixtureResponse(
        @Schema(description = "집기 ID", example = "1", requiredMode = REQUIRED) Long id,
        @Schema(description = "집기 이름", example = "스탠드 행거 1200", requiredMode = REQUIRED) String name,
        @Schema(description = "분류", requiredMode = REQUIRED) FixtureCategory category,
        @Schema(description = "가로 규격(mm)", example = "1200", requiredMode = REQUIRED) int widthMm,
        @Schema(description = "세로 규격(mm)", example = "500", requiredMode = REQUIRED) int depthMm,
        @Schema(description = "소비 전력(W). 비전기 집기는 0", example = "0", requiredMode = REQUIRED) int powerWatt,
        @Schema(description = "일일 렌털료(원)", example = "12000", requiredMode = REQUIRED) long dailyRentalFee,
        @Schema(description = "총 재고 수량", example = "40", requiredMode = REQUIRED) int stockQty) {}
