package com.popupready.server.payment;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;

/**
 * 결제 영속 왕복. <b>{@code rawResponse}가 JSONB라는 사실이 여기서만 드러난다</b> —
 * 순수 단위 테스트는 필드에 무엇을 넣든 통과하고, 잘못된 값은 커밋 시점에야 터진다.
 *
 * <p>실제로 타임아웃 사유를 평문으로 넣었다가 실서버에서 500이 났다. 순수 테스트 8건은 전부
 * 초록이었다.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class PaymentRepositoryTest {

    private static final Instant NOW = Instant.parse("2026-09-01T00:00:00Z");

    @Autowired
    private PaymentRepository paymentRepository;

    private Payment saved(String orderId) {
        return Payment.ready(45L, orderId, 6_930_000L, NOW);
    }

    @Test
    @DisplayName("승인 응답 원문 → JSONB로 왕복된다")
    void approve_roundTripsRawResponse() {
        Payment payment = saved("ORDER-RT-1");
        payment.approve("PAY-1", NOW, "{\"status\":\"DONE\"}");

        Long id = paymentRepository.saveAndFlush(payment).getId();

        assertThat(paymentRepository.findById(id)).get().satisfies(found -> assertThat(found.getRawResponse())
                .contains("DONE"));
    }

    @Test
    @DisplayName("🚨 타임아웃 사유 → 평문이 아니라 유효한 JSON으로 저장된다")
    void markUnknown_storesValidJson() {
        // rawResponse는 JSONB다. 평문을 넣으면 flush 시점에 invalid input syntax for type json이
        // 나고, 그 예외는 500으로 새어나가 "PG 타임아웃"이 "서버 장애"로 보이게 된다.
        Payment payment = saved("ORDER-RT-2");
        payment.markUnknown("PG 응답 없음(타임아웃): read timeout, \"quoted\" 포함");

        Long id = paymentRepository.saveAndFlush(payment).getId();

        assertThat(paymentRepository.findById(id)).get().satisfies(found -> {
            assertThat(found.getStatus()).isEqualTo(PaymentStatus.UNKNOWN);
            assertThat(found.getRawResponse()).contains("timeout");
        });
    }

    @Test
    @DisplayName("orderId는 시도마다 유일하다 → 조회 창구가 성립한다")
    void findByOrderId_returnsAttempt() {
        paymentRepository.saveAndFlush(saved("ORDER-RT-3"));

        assertThat(paymentRepository.findByOrderId("ORDER-RT-3")).isPresent();
    }
}
