package com.popupready.server.reservation;

import com.popupready.server.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * ⚠️ Phase 0 계약 스텁 — 레이아웃 재검증도 견적 계산도 하지 않고 고정 샘플을 돌려준다.
 *
 * <p>실구현(T4-1~T4-3)에서 그리드 범위·겹침·집기 존재·재고 재검증과 견적 계산이 들어온다.
 * 그때 400으로 떨어지는 경우가 늘어날 뿐, 성공 응답의 형태는 여기서 확정된 그대로다.
 */
@RestController
@RequestMapping(value = "/api/v1/reservation-requests", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "reservation", description = "예약 요청")
public class ReservationRequestController {

    private static final Long STUB_RESERVATION_ID = 1L;

    private static final Long STUB_BRAND_USER_ID = 1L;

    @Operation(
            summary = "예약 요청 생성",
            description = "빌더가 만든 도면을 서버에서 재검증하고 견적과 함께 예약 요청을 만든다. "
                    + "그리드 범위를 벗어나거나 집기가 겹치면 400이다.")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ReservationRequestResponse> create(@Valid @RequestBody CreateReservationRequest request) {
        // TODO(T4-1~T4-3): 레이아웃 재검증(웹과 동일 계산식) + 견적 계산으로 교체
        EstimateResponse estimate = new EstimateResponse(14, 6_300_000L, 420_000L, 672_000L, 7_392_000L);
        return ApiResponse.ok(new ReservationRequestResponse(
                STUB_RESERVATION_ID,
                request.spaceId(),
                STUB_BRAND_USER_ID,
                request.startDate(),
                request.endDate(),
                request.layout(),
                estimate,
                ReservationStatus.DRAFT));
    }
}
