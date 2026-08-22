package com.popupready.server.reservation;

import com.popupready.server.auth.JwtPrincipal;
import com.popupready.server.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 예약 요청 생성(US-102 빌더 완료 지점). 브랜드 역할 제한은 {@code SecurityConfig}가 건다. */
@RestController
@RequestMapping(value = "/api/v1/reservation-requests", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "reservation", description = "예약 요청")
public class ReservationRequestController {

    private final ReservationRequestService reservationRequestService;

    public ReservationRequestController(ReservationRequestService reservationRequestService) {
        this.reservationRequestService = reservationRequestService;
    }

    @Operation(
            summary = "예약 요청 생성",
            description = "빌더가 만든 도면을 서버에서 재검증하고 견적과 함께 예약 요청을 만든다. " + "그리드 범위를 벗어나거나 집기가 겹치면 400이다.")
    // 경로에 변수가 없어 공통 커스터마이저(OpenApiConfig)는 404를 붙이지 않는다. 하지만 이 오퍼레이션은
    // 본문으로 다른 리소스(spaceId·fixtureId)를 지목하므로 실제로 404를 낸다 — 문서가 거짓말하지 않게
    // 여기서만 명시한다.
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "404",
            description = "본문이 지목한 공간·집기를 찾을 수 없음",
            content =
                    @Content(
                            mediaType = MediaType.APPLICATION_JSON_VALUE,
                            schema = @Schema(ref = "#/components/schemas/ApiErrorResponse")))
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ReservationRequestResponse> create(
            // 요청자는 본문이 아니라 토큰에서 온다. 문서에는 노출하지 않는다 — 클라이언트가 채울 값이 아니다.
            @Parameter(hidden = true) @AuthenticationPrincipal JwtPrincipal principal,
            @Valid @RequestBody CreateReservationRequest request) {
        return ApiResponse.ok(reservationRequestService.create(principal.userId(), request));
    }
}
