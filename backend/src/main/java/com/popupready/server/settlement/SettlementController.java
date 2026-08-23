package com.popupready.server.settlement;

import com.popupready.server.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 분할 정산 내역 조회(US-203 확인 경로).
 *
 * <p>Phase 0 스텁이다 — 웹의 {@code SettlementBreakdown}(스타일가이드 §8.D)이 붙을 수 있도록
 * 응답 형태를 확정하는 것이 목적이고, 실제 Row 생성·조회는 Phase 3에서 채운다.
 *
 * <p>인가는 <b>당사자</b> 기준이 된다(브랜드·건물주·해당 공급사). 역할로는 가를 수 없어
 * Security가 아니라 서비스가 판정하며, 그 등록은 T0-8에서 함께 한다.
 */
@RestController
@RequestMapping(value = "/api/v1/settlements", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "settlement", description = "다자간 분할 정산")
public class SettlementController {

    @Operation(
            summary = "분할 정산 내역 조회",
            description = "결제 1건이 만든 분할 정산 Row를 모두 돌려준다. " + "보증금 Row는 ESCROW_HELD 상태이며 정산이 아니라 반환 대상이다.")
    @ResponseStatus(HttpStatus.OK)
    @GetMapping
    public ApiResponse<List<SettlementResponse>> byReservation(
            @Parameter(description = "조회할 예약 요청 ID", example = "1") @RequestParam Long reservationId) {
        // Phase 0 스텁 — Phase 3에서 실제 Row 조회로 교체한다.
        return ApiResponse.ok(List.of(
                new SettlementResponse(
                        SettlementType.SPACE_RENT, 2L, 6_300_000L, 630_000L, 5_670_000L, SettlementStatus.PENDING),
                new SettlementResponse(
                        SettlementType.DEPOSIT, 1L, 630_000L, 0L, 630_000L, SettlementStatus.ESCROW_HELD),
                new SettlementResponse(SettlementType.PLATFORM_FEE, 4L, 630_000L, 0L, 0L, SettlementStatus.PENDING)));
    }
}
