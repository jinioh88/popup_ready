package com.popupready.server.payment;

import java.time.Instant;

/**
 * PG 승인 결과. 성공만 표현한다 — 거절은 {@link PaymentDeclinedException},
 * 응답 없음은 {@link PaymentGatewayTimeoutException}이라 세 결과가 타입으로 갈린다.
 *
 * <p>세 갈래를 하나의 리턴값에 담지 않은 이유는 <b>타임아웃을 실패로 뭉개기 쉽기 때문</b>이다.
 * 타입이 다르면 호출자가 셋을 각각 처리하지 않고는 컴파일되지 않는다.
 *
 * @param rawResponse PG 응답 원문. 분쟁 대비로 그대로 보관한다(§2.1)
 */
public record PgApproval(String paymentKey, Instant approvedAt, String rawResponse) {}
