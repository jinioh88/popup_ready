package com.popupready.server.payment;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

/**
 * 결제 게이트웨이 배선 규약.
 *
 * <p>🚨 <b>목 게이트웨이는 기본값이면 안 된다.</b> {@code matchIfMissing = true}로 두면 설정을
 * 빠뜨린 환경에서 목이 조용히 올라와 <b>모든 결제가 무료로 승인된다.</b> 돈을 지키는 자리에서
 * fail-open은 허용되지 않으며, 프로퍼티가 없으면 빈이 없어 기동이 실패하는 쪽이 옳다 —
 * 그 실패는 시끄럽고 배포 전에 잡힌다.
 *
 * <p>개발 시더들도 같은 형태({@code havingValue}만)라 이 클래스만 예외가 되면 안 된다.
 */
class PaymentGatewayWiringTest {

    @Test
    @DisplayName("목 게이트웨이 → 설정이 없을 때 자동으로 뜨지 않는다")
    void mockGateway_isNotTheFallbackDefault() {
        ConditionalOnProperty condition = MockPaymentGateway.class.getAnnotation(ConditionalOnProperty.class);

        assertThat(condition).isNotNull();
        assertThat(condition.matchIfMissing())
                .as("설정 누락 시 목이 뜨면 모든 결제가 무료로 승인된다")
                .isFalse();
        assertThat(condition.havingValue()).isEqualTo("mock");
    }
}
