package com.popupready.server.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 결제 시도의 상태 전이(T2-1). DB가 필요 없어 순수 단위 테스트한다. */
class PaymentTest {

    private static final Instant CREATED_AT = Instant.parse("2026-09-01T00:00:00Z");

    private static final Instant APPROVED_AT = Instant.parse("2026-09-01T00:00:05Z");

    private static Payment ready() {
        return Payment.ready(45L, "ORDER-1", 6_930_000L, CREATED_AT);
    }

    @Test
    @DisplayName("준비 직후 → READY이고 아직 승인되지 않았다")
    void ready_startsAsReady() {
        Payment payment = ready();

        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.READY);
        assertThat(payment.getApprovedAt()).isNull();
        assertThat(payment.getPaymentKey()).isNull();
    }

    @Test
    @DisplayName("PG 승인 → PAID로 전이하고 결제 키·승인 시각·원문을 남긴다")
    void approve_marksPaidAndKeepsRawResponse() {
        // raw_response는 분쟁 대비다(§2.1). 승인 시점의 PG 응답을 그대로 보관한다.
        Payment payment = ready();

        payment.approve("PAY-KEY-1", APPROVED_AT, "{\"status\":\"DONE\"}");

        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.PAID);
        assertThat(payment.getPaymentKey()).isEqualTo("PAY-KEY-1");
        assertThat(payment.getApprovedAt()).isEqualTo(APPROVED_AT);
        assertThat(payment.getRawResponse()).contains("DONE");
    }

    @Test
    @DisplayName("PG 거절 → FAILED로 전이하고 거절 응답도 보관한다")
    void fail_keepsRawResponse() {
        Payment payment = ready();

        payment.fail("{\"code\":\"REJECT_CARD_COMPANY\"}");

        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.FAILED);
        assertThat(payment.getRawResponse()).contains("REJECT_CARD_COMPANY");
    }

    @Test
    @DisplayName("🚨 PG 타임아웃 → UNKNOWN. 승인 여부를 모른다고 정직하게 남긴다")
    void markUnknown_onTimeout() {
        // FAILED로 적으면 "PG는 승인했는데 우리는 실패로 안다"가 조용해진다.
        // 자동 대사는 이번 스프린트 범위가 아니고, 수동 확인이 가능한 흔적을 남기는 것까지다.
        Payment payment = ready();

        payment.markUnknown("read timeout after 10s");

        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.UNKNOWN);
        assertThat(payment.getRawResponse()).contains("timeout");
    }

    @Test
    @DisplayName("이미 승인된 결제를 다시 승인 → 거절한다")
    void approve_alreadyPaid_isRejected() {
        Payment payment = ready();
        payment.approve("PAY-KEY-1", APPROVED_AT, "{}");

        assertThatThrownBy(() -> payment.approve("PAY-KEY-2", APPROVED_AT, "{}"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("실패한 결제를 승인으로 뒤집기 → 거절한다")
    void approve_afterFailed_isRejected() {
        // 같은 시도를 나중에 성공으로 덮어쓸 수 있으면 raw_response가 분쟁 자료이기를 그만둔다.
        // 재시도는 새 orderId로 새 Payment를 만든다.
        Payment payment = ready();
        payment.fail("{}");

        assertThatThrownBy(() -> payment.approve("PAY-KEY-1", APPROVED_AT, "{}"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("승인된 결제 → 취소로 전이한다")
    void cancel_afterPaid_transitions() {
        Payment payment = ready();
        payment.approve("PAY-KEY-1", APPROVED_AT, "{}");

        payment.cancel("{\"status\":\"CANCELED\"}");

        assertThat(payment.getStatus()).isEqualTo(PaymentStatus.CANCELLED);
    }

    @Test
    @DisplayName("승인되지 않은 결제를 취소 → 거절한다")
    void cancel_beforePaid_isRejected() {
        assertThatThrownBy(() -> ready().cancel("{}")).isInstanceOf(IllegalStateException.class);
    }
}
