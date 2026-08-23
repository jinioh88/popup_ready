package com.popupready.server.payment;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import com.popupready.server.reservation.ReservationStatus;
import com.popupready.server.settlement.SettlementResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

/**
 * 결제 승인 결과(§2.2-A) — 확정된 예약과 그 결제가 만든 분할 정산 Row 요약.
 *
 * <p>정산 Row를 함께 내려주는 것은 웹의 결제 완료 화면이 곧바로 {@code SettlementBreakdown}을
 * 그릴 수 있게 하기 위해서다. 별도 조회를 강제하면 "결제는 됐는데 내역은 아직"인 중간 상태가
 * 화면에 생긴다.
 */
@Schema(description = "결제 승인 결과")
public record PaymentConfirmResponse(
        @Schema(description = "예약 요청 ID", example = "1", requiredMode = REQUIRED) Long reservationRequestId,
        @Schema(description = "확정된 예약 상태", requiredMode = REQUIRED) ReservationStatus reservationStatus,
        @Schema(description = "토스 주문 ID", requiredMode = REQUIRED) String orderId,
        @Schema(description = "결제 상태", requiredMode = REQUIRED) PaymentStatus status,
        @Schema(description = "승인된 금액(원)", example = "6930000", requiredMode = REQUIRED) long amount,
        @Schema(description = "PG 승인 시각(UTC)", requiredMode = REQUIRED) Instant approvedAt,
        @Schema(description = "이 결제가 만든 분할 정산 Row", requiredMode = REQUIRED) List<SettlementResponse> settlements) {}
