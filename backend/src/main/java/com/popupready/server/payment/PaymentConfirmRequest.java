package com.popupready.server.payment;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

/**
 * 결제 승인 요청(US-201 핵심 경로, §2.2-C).
 *
 * <p>⚠️ <b>{@code amount}는 승인 금액이 아니라 대조 대상이다.</b> 서버는 견적 스냅샷의 합계로
 * 승인하고 이 값과 다르면 400 {@code PAYMENT_AMOUNT_MISMATCH}를 낸다 — 클라이언트가 보낸
 * 금액을 그대로 승인하지 않는 것이 프론트 신뢰를 끊는 지점이다(§2.2-C 2-5).
 */
@Schema(description = "결제 승인 요청")
public record PaymentConfirmRequest(
        @Schema(description = "토스가 발급한 결제 키") @NotBlank(message = "paymentKey는 필수입니다") String paymentKey,
        @Schema(description = "결제 준비 때 받은 주문 ID") @NotBlank(message = "orderId는 필수입니다") String orderId,
        @Schema(description = "클라이언트가 본 금액(원). 서버 견적과 대조만 한다", example = "6930000")
                @Positive(message = "amount는 0보다 커야 합니다")
                long amount) {}
