package com.popupready.server.payment;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 결제 준비 결과(§2.2-A). 토스 결제 위젯에 그대로 넘기는 값이다.
 *
 * <p><b>이 경로는 락을 잡지 않는다</b> — 위젯 표시용이며 자리를 선점하지 않는다. 실제 선점은
 * 승인({@code payment/confirm})에서 일어난다.
 *
 * <p>{@code amount}는 요청 본문이 아니라 <b>견적 스냅샷</b>에서 온다(§2.2-E).
 *
 * <p>{@code orderId}는 호출할 때마다 새로 발급된다 — <b>재사용하지 않는다</b>(2026-08-23 백엔드
 * 결정). 이미 승인 시도된 orderId는 PG가 거부할 수 있고, 재사용하면 "이전 시도가 실제로는
 * 승인됐는데 응답만 유실된" 경우와 "정말 실패한" 경우를 구분할 수 없다.
 */
@Schema(description = "결제 준비 결과")
public record PaymentPrepareResponse(
        @Schema(description = "토스 주문 ID. 호출마다 새로 발급되며 재사용하지 않는다", requiredMode = REQUIRED) String orderId,
        @Schema(description = "결제할 금액(원). 견적 스냅샷의 합계다", example = "6930000", requiredMode = REQUIRED) long amount,
        @Schema(description = "위젯에 표시할 주문명", example = "성수 팝업 스페이스 14일 대여", requiredMode = REQUIRED)
                String orderName) {}
