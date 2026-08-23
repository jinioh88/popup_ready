package com.popupready.server.contract;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ContractRepository extends JpaRepository<Contract, Long> {

    /** 예약 재진입 시 기존 계약을 되찾는 경로(GET /reservation-requests/{id}/contract). */
    Optional<Contract> findByReservationRequestId(Long reservationRequestId);

    boolean existsByReservationRequestId(Long reservationRequestId);
}
