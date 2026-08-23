package com.popupready.server.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 목 PG. 여기서 확인하는 것은 승인 로직이 아니라 <b>실패 경로를 재현할 수 있는가</b>다 —
 * 재현할 수 없으면 웹·모바일이 실패 화면을 만들 방법이 없어 성공 경로만 있는 결제 UI가 만들어진다.
 */
class MockPaymentGatewayTest {

    private static final Instant NOW = Instant.parse("2026-09-01T00:00:00Z");

    private final MockPaymentGateway gateway = new MockPaymentGateway(() -> NOW);

    @Test
    @DisplayName("평범한 결제 키 → 승인하고 응답 원문을 돌려준다")
    void approve_returnsApprovalWithRawResponse() {
        PgApproval approval = gateway.approve("PAY-KEY-1", "ORDER-1", 6_930_000L);

        assertThat(approval.paymentKey()).isEqualTo("PAY-KEY-1");
        assertThat(approval.approvedAt()).isEqualTo(NOW);
        assertThat(approval.rawResponse()).contains("ORDER-1").contains("6930000");
    }

    @Test
    @DisplayName("DECLINE- 접두 → 거절 예외를 던지고 거절 응답을 담는다")
    void declinePrefix_throwsDeclined() {
        assertThatThrownBy(() -> gateway.approve("DECLINE-1", "ORDER-1", 1000L))
                .isInstanceOf(PaymentDeclinedException.class)
                .extracting(e -> ((PaymentDeclinedException) e).getRawResponse())
                .asString()
                .contains("REJECT_CARD_COMPANY");
    }

    @Test
    @DisplayName("🚨 TIMEOUT- 접두 → 거절이 아니라 타임아웃 예외다(승인 여부 불명)")
    void timeoutPrefix_throwsTimeoutNotDeclined() {
        // 둘을 같은 타입으로 만들면 호출자가 타임아웃을 실패로 뭉갠다.
        assertThatThrownBy(() -> gateway.approve("TIMEOUT-1", "ORDER-1", 1000L))
                .isInstanceOf(PaymentGatewayTimeoutException.class)
                .isNotInstanceOf(PaymentDeclinedException.class);
    }
}
