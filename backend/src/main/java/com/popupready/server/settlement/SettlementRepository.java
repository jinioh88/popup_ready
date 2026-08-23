package com.popupready.server.settlement;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SettlementRepository extends JpaRepository<Settlement, Long> {

    List<Settlement> findByPaymentIdOrderByIdAsc(Long paymentId);
}
