package com.popupready.server.space;

import com.popupready.server.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.validation.annotation.Validated;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * ⚠️ Phase 0 계약 스텁 — 필터를 무시하고 고정 샘플을 돌려준다.
 *
 * <p>실구현(T3-1·T3-2)에서 PostGIS {@code ST_DWithin} 반경 검색으로 속을 채우며,
 * 그때도 여기 확정된 파라미터 이름·응답 필드는 바꾸지 않는다.
 */
@RestController
@RequestMapping(value = "/api/v1/spaces", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "space", description = "공실 상가 탐색")
@Validated
public class SpaceController {

    /** 웹이 반경을 계산하지 못하는 초기 진입에서 쓰는 기본값(m). */
    private static final int DEFAULT_RADIUS_METERS = 1000;

    @Operation(
            summary = "반경 공실 검색",
            description = "중심 좌표 기준 반경(m) 안의 ACTIVE 공간을 찾는다. 면적·대여료·전력 필터는 모두 선택이다.")
    @GetMapping
    public ApiResponse<List<SpaceSummaryResponse>> search(
            @Parameter(description = "중심 위도", required = true, example = "37.5445")
                    @RequestParam
                    @DecimalMin(value = "-90.0")
                    @DecimalMax(value = "90.0")
                    double lat,
            @Parameter(description = "중심 경도", required = true, example = "127.0557")
                    @RequestParam
                    @DecimalMin(value = "-180.0")
                    @DecimalMax(value = "180.0")
                    double lng,
            @Parameter(description = "검색 반경(m). 미지정 시 1000", example = "1500")
                    @RequestParam(defaultValue = "" + DEFAULT_RADIUS_METERS)
                    @Positive
                    @Max(50_000)
                    int radius,
            @Parameter(description = "최소 실면적(㎡)", example = "50")
                    @RequestParam(required = false)
                    @PositiveOrZero
                    Double minArea,
            @Parameter(description = "일일 대여료 상한(원)", example = "600000")
                    @RequestParam(required = false)
                    @PositiveOrZero
                    Long maxRent,
            @Parameter(description = "최소 허용 전력(W)", example = "3000")
                    @RequestParam(required = false)
                    @PositiveOrZero
                    Integer minPower) {
        return ApiResponse.ok(List.of(
                new SpaceSummaryResponse(
                        1L,
                        "성수 연무장길 팝업 1층",
                        "서울 성동구 연무장길 45",
                        new LocationDto(37.5445, 127.0557),
                        450_000L,
                        82.5,
                        5_000),
                new SpaceSummaryResponse(
                        2L,
                        "명동 유네스코길 스트리트 스토어",
                        "서울 중구 명동길 26",
                        new LocationDto(37.5636, 126.9827),
                        780_000L,
                        61.0,
                        4_000)));
    }

    @Operation(summary = "상가 상세", description = "요약 카드 필드에 빌더 캔버스용 grid 정보를 더해 돌려준다.")
    @GetMapping("/{id}")
    public ApiResponse<SpaceDetailResponse> detail(
            @Parameter(description = "공간 ID", example = "1") @PathVariable Long id) {
        return ApiResponse.ok(new SpaceDetailResponse(
                id,
                "성수 연무장길 팝업 1층",
                "서울 성동구 연무장길 45",
                new LocationDto(37.5445, 127.0557),
                450_000L,
                new BigDecimal("0.10"),
                82.5,
                5_000,
                20,
                12,
                500,
                SpaceStatus.ACTIVE));
    }
}
