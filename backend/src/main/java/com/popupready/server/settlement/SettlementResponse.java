package com.popupready.server.settlement;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 분할 정산 Row 하나(US-203, 스프린트 문서 §2.2-A).
 *
 * <p><b>{@code netAmount}는 "실제로 이체할 금액"이다</b>(§2.1 정의). 이 정의 덕에
 * {@code PLATFORM_FEE} Row의 net이 0인 것이 누락이 아니라 "이체 대상이 아님"으로 읽히고,
 * Sprint 3의 US-403 배치는 {@code net > 0}인 Row만 훑으면 된다.
 *
 * <p>합계 불변식: <b>{@code Σ(netAmount) + Σ(feeAmount) == payment.amount}</b>.
 * 1원이라도 새면 안 되며 T3-2가 테스트로 못 박는다.
 */
@Schema(description = "분할 정산 Row")
public record SettlementResponse(
        @Schema(description = "정산 종류", requiredMode = REQUIRED) SettlementType type,
        @Schema(description = "정산 대상 사용자 ID", example = "2", requiredMode = REQUIRED) Long payeeId,
        @Schema(description = "정산 대상 총액(원)", example = "6300000", requiredMode = REQUIRED) long grossAmount,
        @Schema(description = "원천 차감된 플랫폼 수수료(원)", example = "630000", requiredMode = REQUIRED) long feeAmount,
        @Schema(description = "실제로 이체할 금액(원)", example = "5670000", requiredMode = REQUIRED) long netAmount,
        @Schema(description = "정산 상태. 보증금만 ESCROW_HELD로 생성된다", requiredMode = REQUIRED) SettlementStatus status) {}
