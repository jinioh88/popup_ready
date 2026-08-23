package com.popupready.server.payment;

import java.util.function.Consumer;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * PG 실패를 <b>별도 트랜잭션</b>으로 남긴다.
 *
 * <p>승인 트랜잭션은 실패 시 롤백되므로 같은 트랜잭션에 기록하면 <b>기록도 함께 사라진다</b> —
 * 그러면 {@code UNKNOWN} 상태를 남기려던 목적이 통째로 무의미해진다.
 *
 * <p><b>별도 클래스인 것이 핵심이다.</b> {@code PaymentService} 안에 메서드로 두면 자기 호출이라
 * 프록시를 거치지 않아 {@code REQUIRES_NEW}가 적용되지 않는다 — 애노테이션은 붙어 있는데 새
 * 트랜잭션은 열리지 않고, 증상은 "가끔 실패 기록이 없다"로 나타나 원인에 닿기 어렵다.
 */
@Component
public class PaymentFailureRecorder {

    private final PaymentRepository paymentRepository;

    public PaymentFailureRecorder(PaymentRepository paymentRepository) {
        this.paymentRepository = paymentRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String orderId, Consumer<Payment> mark) {
        paymentRepository.findByOrderId(orderId).ifPresent(mark);
    }
}
