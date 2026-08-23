package com.popupready.server.payment;

import com.popupready.server.settlement.PaidPaymentLookup;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** {@link PaidPaymentLookup} 구현. 결제 도메인이 자기 저장소를 들여다보는 쪽에 둔다. */
@Component
@Transactional(readOnly = true)
public class PaidPaymentLookupImpl implements PaidPaymentLookup {

    private final PaymentRepository paymentRepository;

    public PaidPaymentLookupImpl(PaymentRepository paymentRepository) {
        this.paymentRepository = paymentRepository;
    }

    @Override
    public Long paidPaymentIdOf(Long reservationRequestId) {
        return paymentRepository
                .findFirstByReservationRequestIdAndStatusOrderByIdDesc(reservationRequestId, PaymentStatus.PAID)
                .map(Payment::getId)
                .orElse(null);
    }
}
