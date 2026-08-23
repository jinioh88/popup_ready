package com.popupready.server.payment;

import lombok.Getter;

/** PG가 승인을 거절했다. 응답 원문은 실패 기록에 그대로 남는다. */
@Getter
public class PaymentDeclinedException extends RuntimeException {

    private final String rawResponse;

    public PaymentDeclinedException(String message, String rawResponse) {
        super(message);
        this.rawResponse = rawResponse;
    }
}
