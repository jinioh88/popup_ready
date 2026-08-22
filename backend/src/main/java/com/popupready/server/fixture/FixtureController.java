package com.popupready.server.fixture;

import com.popupready.server.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * ⚠️ Phase 0 계약 스텁 — category를 무시하고 고정 샘플을 돌려준다.
 *
 * <p>실구현(T3-2)에서 카테고리 필터와 시드 데이터로 속을 채운다.
 */
@RestController
@RequestMapping(value = "/api/v1/fixtures", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "fixture", description = "모듈러 집기 라이브러리")
public class FixtureController {

    @Operation(summary = "집기 라이브러리 조회", description = "category를 주면 해당 분류만, 없으면 전체를 돌려준다.")
    @GetMapping
    public ApiResponse<List<FixtureResponse>> list(
            @Parameter(description = "집기 분류 필터. 생략 시 전체") @RequestParam(required = false)
                    FixtureCategory category) {
        return ApiResponse.ok(List.of(
                new FixtureResponse(1L, "스탠드 행거 1200", FixtureCategory.HANGER, 1_200, 500, 0, 12_000L, 40),
                new FixtureResponse(2L, "POS 카운터 900", FixtureCategory.POS, 900, 600, 150, 25_000L, 12),
                new FixtureResponse(3L, "유리 쇼케이스 1000", FixtureCategory.SHOWCASE, 1_000, 500, 90, 30_000L, 18),
                new FixtureResponse(4L, "트랙 조명 3구", FixtureCategory.LIGHTING, 300, 300, 120, 8_000L, 60)));
    }
}
