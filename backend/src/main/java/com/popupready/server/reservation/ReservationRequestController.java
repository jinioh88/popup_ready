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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
            operationId = "getReservationRequest",
            summary = "예약 요청 단건 조회",
            description = "견적 스냅샷을 포함한 예약 요청을 돌려준다. 예약의 브랜드 본인이거나 그 공간의 건물주만 볼 수 있다.")
    @ResponseStatus(HttpStatus.OK)
    @GetMapping("/{id}")
    // ⚠️ 메서드 이름이 곧 operationId다. springdoc은 이름이 겹치면 _1·_2 접미사를 붙이는데,
    //    그 번호는 컨트롤러 스캔 순서에 달려 있어 <b>무관한 컨트롤러가 같은 이름의 메서드를
    //    추가하는 것만으로 남의 operationId가 밀린다.</b> 실제로 이 메서드를 detail로 두었더니
    //    /contracts/{id}가 detail_1에서 detail_2로 바뀌었다. 겹치지 않는 이름을 쓴다.
    public ApiResponse<ReservationRequestResponse> findById(
            @Parameter(hidden = true) @AuthenticationPrincipal JwtPrincipal principal,
            @Parameter(description = "예약 요청 ID", example = "1") @PathVariable Long id) {
        return ApiResponse.ok(reservationRequestService.detail(principal.userId(), id));
    }

    @Operation(
            operationId = "createReservationRequest",
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
