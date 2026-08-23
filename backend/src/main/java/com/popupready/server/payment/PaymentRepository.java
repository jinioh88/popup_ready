package com.popupready.server.payment;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    Optional<Payment> findByOrderId(String orderId);

    /** 예약당 PAID는 최대 1건이라는 실질 제약의 조회 창구. */
    boolean existsByReservationRequestIdAndStatus(Long reservationRequestId, PaymentStatus status);

    Optional<Payment> findFirstByReservationRequestIdAndStatusOrderByIdDesc(
            Long reservationRequestId, PaymentStatus status);
}
