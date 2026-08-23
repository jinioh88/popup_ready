package com.popupready.server.reservation;

import com.popupready.server.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 날짜별 집기 가용 수량(§2.2-A, US-102 빌더 선행 표시).
 *
 * <p><b>경로는 {@code /spaces/...}인데 패키지는 {@code reservation}이다.</b> 의도한 배치다 —
 * 가용 수량은 "그 날짜에 다른 예약이 집기를 얼마나 잡아갔는가"라서 예약 도메인의 지식이고,
 * {@code space}에 두면 공간 도메인이 예약 저장소를 들여다봐야 해 패키지 경계 규칙이 깨진다.
 * 컨트롤러의 URL이 패키지 이름을 따를 이유는 없으므로 계약(경로)은 그대로 두고 소유만 옮겼다.
 *
 * <p>T1-2 실구현. 경로·파라미터·응답 필드는 Phase 0에서 확정한 그대로이며 속만 채웠다.
 */
@RestController
@RequestMapping(value = "/api/v1/spaces", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "reservation", description = "예약 요청")
public class FixtureAvailabilityController {

    private final FixtureAvailabilityService fixtureAvailabilityService;

    public FixtureAvailabilityController(FixtureAvailabilityService fixtureAvailabilityService) {
        this.fixtureAvailabilityService = fixtureAvailabilityService;
    }

    @Operation(
            operationId = "getFixtureAvailability",
            summary = "날짜별 집기 가용 수량",
            description =
                    "해당 기간에 배치 가능한 집기 수량을 집기별로 돌려준다. " + "수량은 질의 기간 중 가장 많이 잡힌 날 기준이며, 다른 공간의 예약이 잡아간 수량도 함께 차감된다.")
    @GetMapping("/{spaceId}/fixture-availability")
    public ApiResponse<List<FixtureAvailabilityResponse>> availability(
            @Parameter(description = "대상 공간 ID", example = "1") @PathVariable Long spaceId,
            @Parameter(description = "사용 시작일", example = "2026-09-01")
                    @RequestParam
                    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                    LocalDate startDate,
            @Parameter(description = "사용 종료일", example = "2026-09-14")
                    @RequestParam
                    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                    LocalDate endDate) {
        // 기간 검증은 예약 생성과 같은 규칙을 쓴다 — 뒤집힌 날짜나 30일 초과를 여기서만 통과시키면
        // 빌더가 배치할 수 있다고 표시한 기간이 예약 단계에서 거절된다.
        return ApiResponse.ok(fixtureAvailabilityService.availability(ReservationPeriod.of(startDate, endDate)));
    }
}
