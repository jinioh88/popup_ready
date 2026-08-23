package com.popupready.server.settlement;

import com.popupready.server.auth.JwtPrincipal;
import com.popupready.server.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 분할 정산 내역 조회(US-203 확인 경로).
 *
 * <p>T3-3 실구현. 웹의 {@code SettlementBreakdown}(스타일가이드 §8.D)이 이 응답으로 그려진다.
 *
 * <p>인가는 <b>당사자</b> 기준이 된다(브랜드·건물주·해당 공급사). 역할로는 가를 수 없어
 * Security가 아니라 서비스가 판정하며, 그 등록은 T0-8에서 함께 한다.
 */
@RestController
@RequestMapping(value = "/api/v1/settlements", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "settlement", description = "다자간 분할 정산")
public class SettlementController {

    private final SettlementService settlementService;

    public SettlementController(SettlementService settlementService) {
        this.settlementService = settlementService;
    }

    @Operation(
            operationId = "listSettlements",
            summary = "분할 정산 내역 조회",
            description = "결제 1건이 만든 분할 정산 Row를 모두 돌려준다. " + "보증금 Row는 ESCROW_HELD 상태이며 정산이 아니라 반환 대상이다.")
    @ResponseStatus(HttpStatus.OK)
    @GetMapping
    public ApiResponse<List<SettlementResponse>> byReservation(
            @Parameter(hidden = true) @AuthenticationPrincipal JwtPrincipal principal,
            @Parameter(description = "조회할 예약 요청 ID", example = "1") @RequestParam Long reservationId) {
        return ApiResponse.ok(settlementService.findByReservation(principal.userId(), reservationId));
    }
}
