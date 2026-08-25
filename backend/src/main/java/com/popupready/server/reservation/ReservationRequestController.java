package com.popupready.server.reservation;

import com.popupready.server.auth.JwtPrincipal;
import com.popupready.server.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
            operationId = "listReservationRequests",
            summary = "내 예약 목록",
            description = "로그인한 사용자가 만든 예약 요청을 최근 순으로 돌려준다. status를 주면 그 상태만 거른다. "
                    + "건물주의 '내 공간 예약 목록'은 조회 축이 다른 별개의 유스케이스이며 이 경로가 아니다.")
    @ResponseStatus(HttpStatus.OK)
    @GetMapping
    public ApiResponse<List<ReservationRequestResponse>> listMine(
            @Parameter(hidden = true) @AuthenticationPrincipal JwtPrincipal principal,
            @Parameter(description = "거를 상태. 생략하면 전체") @RequestParam(required = false) ReservationStatus status) {
        return ApiResponse.ok(reservationRequestService.listMine(principal.userId(), status));
    }

    @Operation(
            operationId = "getReservationRequest",
            summary = "예약 요청 단건 조회",
            description = "견적 스냅샷을 포함한 예약 요청을 돌려준다. 예약의 브랜드 본인이거나 그 공간의 건물주만 볼 수 있다.")
    @ResponseStatus(HttpStatus.OK)
    @GetMapping("/{id}")
    public ApiResponse<ReservationRequestResponse> findById(
            @Parameter(hidden = true) @AuthenticationPrincipal JwtPrincipal principal,
            @Parameter(description = "예약 요청 ID", example = "1") @PathVariable Long id) {
        return ApiResponse.ok(reservationRequestService.detail(principal.userId(), id));
    }

    @Operation(
            operationId = "createReservationRequest",
            summary = "예약 요청 생성",
            description = "빌더가 만든 도면을 서버에서 재검증하고 견적과 함께 예약 요청을 만든다. "
                    + "그리드 범위를 벗어나거나 집기가 겹치면 400이고, 같은 공간에 기간이 겹치는 결제 완료 예약이 있으면 409다. "
                    + "409는 조기 안내이며 자리를 확정하지 않는다 — 최종 판정은 결제 승인이 분산 락 안에서 한다.")
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
    // 결제 승인이 내는 것과 같은 코드다(SPACE_ALREADY_BOOKED). 같은 판정을 생성 시점에도
    // 부르므로 웹은 두 화면에서 같은 문구를 쓸 수 있다.
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "409",
            description = "같은 공간에 기간이 겹치는 결제 완료 예약이 있음 (SPACE_ALREADY_BOOKED)",
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
