package com.popupready.server.payment;

import com.popupready.server.common.ApiResponse;
import com.popupready.server.reservation.ReservationStatus;
import com.popupready.server.settlement.SettlementResponse;
import com.popupready.server.settlement.SettlementStatus;
import com.popupready.server.settlement.SettlementType;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 결제 준비·승인(US-201).
 *
 * <p><b>경로는 {@code /reservation-requests/...}인데 패키지는 {@code payment}다.</b> 결제는 예약에
 * 종속된 하위 리소스라 URL은 예약 아래가 맞고, 소유는 결제 도메인이 갖는 것이 맞다 —
 * {@code reservation}에 두면 예약 서비스가 PG 연동·락·정산 생성까지 떠안아 갓 클래스가 된다.
 *
 * <p>Phase 0 스텁이다. 실제 원자적 승인 경로(§2.2-C 9단계)는 Phase 2에서 채운다.
 */
@RestController
@RequestMapping(value = "/api/v1/reservation-requests", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "payment", description = "결제 준비·승인")
public class PaymentController {

    private static final String ERROR_ENVELOPE_REF = "#/components/schemas/ApiErrorResponse";

    @Operation(
            summary = "결제 준비",
            description = "토스 결제 위젯에 넘길 주문 정보를 발급한다. 락을 잡지 않으며 자리를 선점하지 않는다. " + "orderId는 호출마다 새로 발급되고 재사용하지 않는다.")
    @ResponseStatus(HttpStatus.CREATED)
    @PostMapping("/{id}/payment/prepare")
    public ApiResponse<PaymentPrepareResponse> prepare(
            @Parameter(description = "예약 요청 ID", example = "1") @PathVariable Long id) {
        // Phase 0 스텁 — T2-3에서 실구현.
        return ApiResponse.ok(new PaymentPrepareResponse("STUB-ORDER-ID", 6_930_000L, "성수 팝업 스페이스 14일 대여"));
    }

    @Operation(
            summary = "결제 승인",
            description = "분산 락 안에서 예약 상태·기간 겹침·집기 가용량·전력 한도·금액을 재확인한 뒤 PG 승인을 호출하고, "
                    + "예약을 PAID로 확정하며 분할 정산 Row를 만든다. 요청 금액은 승인 금액이 아니라 대조 대상이다.")
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "409",
            description = "이미 결제됨 / 기간 겹침 (PAYMENT_ALREADY_COMPLETED, FIXTURE_UNAVAILABLE)",
            content = @Content(schema = @Schema(ref = ERROR_ENVELOPE_REF)))
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "503",
            description = "락 획득 실패 — 사용자 잘못이 아니므로 재시도를 안내한다 (LOCK_ACQUISITION_FAILED)",
            content = @Content(schema = @Schema(ref = ERROR_ENVELOPE_REF)))
    @ResponseStatus(HttpStatus.OK)
    @PostMapping("/{id}/payment/confirm")
    public ApiResponse<PaymentConfirmResponse> confirm(
            @Parameter(description = "예약 요청 ID", example = "1") @PathVariable Long id,
            @Valid @RequestBody PaymentConfirmRequest request) {
        // Phase 0 스텁 — T2-5에서 §2.2-C 9단계로 실구현.
        return ApiResponse.ok(new PaymentConfirmResponse(
                id,
                ReservationStatus.CONTRACT_SIGNED,
                request.orderId(),
                PaymentStatus.READY,
                request.amount(),
                Instant.parse("2026-09-01T00:00:00Z"),
                List.of(new SettlementResponse(
                        SettlementType.SPACE_RENT, 2L, 6_300_000L, 630_000L, 5_670_000L, SettlementStatus.PENDING))));
    }
}
