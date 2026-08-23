package com.popupready.server.payment;

/**
 * PG 연동 경계. {@code backend/CLAUDE.md}가 인터페이스 격리를 허용한 <b>두 곳 중 하나</b>다 —
 * 교체 가능성이 실재하기 때문이고(토스 ↔ 목), 그 외 내부 로직에는 포트/어댑터를 만들지 않는다.
 *
 * <p><b>승인은 멱등하지 않다.</b> 구현체는 타임아웃을 반드시 걸되 <b>자동 재시도를 하지 않는다</b> —
 * 타임아웃 후 재호출은 이중 승인 위험이다.
 */
public interface PaymentGateway {

    /**
     * @throws PaymentDeclinedException PG가 거절했다
     * @throws PaymentGatewayTimeoutException 시간 안에 응답이 없다 — 승인 여부를 모른다
     */
    PgApproval approve(String paymentKey, String orderId, long amount);
}
