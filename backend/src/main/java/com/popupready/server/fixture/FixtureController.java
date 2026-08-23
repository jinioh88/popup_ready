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

/** 모듈러 집기 라이브러리(T3-2 실구현). 빌더의 라이브러리 패널이 이 결과로 채워진다. */
@RestController
@RequestMapping(value = "/api/v1/fixtures", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "fixture", description = "모듈러 집기 라이브러리")
public class FixtureController {

    private final FixtureService fixtureService;

    public FixtureController(FixtureService fixtureService) {
        this.fixtureService = fixtureService;
    }

    @Operation(
            operationId = "listFixtures",
            summary = "집기 라이브러리 조회",
            description = "category를 주면 해당 분류만, 없으면 전체를 돌려준다.")
    @GetMapping
    public ApiResponse<List<FixtureResponse>> list(
            @Parameter(description = "집기 분류 필터. 생략 시 전체") @RequestParam(required = false) FixtureCategory category) {
        return ApiResponse.ok(fixtureService.list(category));
    }
}
