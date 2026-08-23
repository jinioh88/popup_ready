package com.popupready.server.reservation;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReservationRequestRepository extends JpaRepository<ReservationRequest, Long> {

    /** 내 예약 목록. 최근 것이 먼저 온다 — 현장에서 찾는 것은 대개 방금 만든 예약이다. */
    List<ReservationRequest> findByBrandUserIdOrderByIdDesc(long brandUserId);

    List<ReservationRequest> findByBrandUserIdAndStatusOrderByIdDesc(long brandUserId, ReservationStatus status);
}
