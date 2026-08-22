package com.popupready.server.space;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 지도 마커 + 우측 요약 카드용 축약형(US-101). 카드가 상세 조회 없이 바로 그려져야 하므로
 * 주소까지 포함한다. 도면 grid 정보는 빌더 진입 시점에만 필요하므로 상세 응답에만 있다.
 */
@Schema(description = "공간 요약(지도 마커·요약 카드용)")
public record SpaceSummaryResponse(
        @Schema(description = "공간 ID", example = "1", requiredMode = REQUIRED) Long id,
        @Schema(description = "공간 이름", example = "성수 연무장길 팝업 1층", requiredMode = REQUIRED) String name,
        @Schema(description = "주소", example = "서울 성동구 연무장길 45", requiredMode = REQUIRED) String address,
        @Schema(description = "위치 좌표", requiredMode = REQUIRED) LocationDto location,
        @Schema(description = "일일 대여료(원)", example = "450000", requiredMode = REQUIRED) long dailyRent,
        @Schema(description = "실면적(㎡)", example = "82.5", requiredMode = REQUIRED) double floorAreaM2,
        @Schema(description = "허용 전력(W)", example = "5000", requiredMode = REQUIRED) int maxPowerWatt) {}
