package com.popupready.server.payment;

/**
 * PG 호출이 시간 안에 끝나지 않았다. <b>승인됐는지 아닌지 모르는 상태</b>이며 거절과 다르다.
 *
 * <p>이 예외를 거절과 같게 다루면 "PG는 승인했는데 우리는 실패로 안다"가 조용해진다.
 * 호출자는 {@code Payment}를 {@code UNKNOWN}으로 남기고 503으로 응답해야 한다.
 */
public class PaymentGatewayTimeoutException extends RuntimeException {

    public PaymentGatewayTimeoutException(String message, Throwable cause) {
        super(message, cause);
    }
}
