package com.popupready.server.space;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 위경도 좌표. 내부적으로는 PostGIS {@code geometry(Point,4326)}로 저장되지만,
 * 지도 SDK가 바로 쓸 수 있도록 API 경계에서는 lat/lng 쌍으로 평평하게 내보낸다.
 */
@Schema(description = "위경도 좌표(WGS84)")
public record LocationDto(
        @Schema(description = "위도", example = "37.5445", requiredMode = REQUIRED) double lat,
        @Schema(description = "경도", example = "127.0557", requiredMode = REQUIRED) double lng) {}
