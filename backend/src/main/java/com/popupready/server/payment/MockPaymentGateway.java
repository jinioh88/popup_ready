package com.popupready.server.payment;

import java.time.Instant;
import java.util.function.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * 로컬·테스트용 PG. 토스 테스트 키가 없어도 결제 경로 전체가 왕복되게 한다 —
 * 키 발급이 웹 파트 소관이라 백엔드가 기다리지 않기 위해서다(§8).
 *
 * <p><b>기본값이 아니다.</b> {@code popupready.payment.gateway=mock}을 <b>명시해야</b> 뜬다 —
 * 설정을 빠뜨린 환경에서 이 목이 조용히 올라오면 모든 결제가 무료로 승인된다. 실 연동은
 * {@code =toss}로 바꾼다(구현체는 웹의 테스트 키 확보 후 추가).
 *
 * <p>거절·타임아웃 경로를 <b>{@code paymentKey} 접두로 재현</b>할 수 있다. 그러지 않으면 웹·모바일이
 * 실패 화면을 만들 방법이 없어 "성공 경로만 있는 결제 UI"가 만들어진다.
 *
 * <pre>
 * DECLINE- 로 시작 → 거절
 * TIMEOUT- 로 시작 → 타임아웃(승인 여부 불명)
 * 그 외              → 승인
 * </pre>
 */
@Component
// ⚠️ matchIfMissing을 쓰지 않는다. 설정이 없을 때 이 목이 뜨면 <b>모든 결제가 무료로 승인된다</b> —
//    돈을 지키는 자리에서 fail-open은 허용되지 않는다. 프로퍼티가 없으면 PaymentGateway 빈이
//    아예 없어 기동이 실패하며, 그 실패는 시끄럽다. 개발 시더들도 같은 이유로 havingValue만 쓴다.
@ConditionalOnProperty(name = "popupready.payment.gateway", havingValue = "mock")
public class MockPaymentGateway implements PaymentGateway {

    private static final Logger log = LoggerFactory.getLogger(MockPaymentGateway.class);

    private static final String DECLINE_PREFIX = "DECLINE-";

    private static final String TIMEOUT_PREFIX = "TIMEOUT-";

    private final Supplier<Instant> clock;

    public MockPaymentGateway(Supplier<Instant> clock) {
        this.clock = clock;
    }

    @Override
    public PgApproval approve(String paymentKey, String orderId, long amount) {
        if (paymentKey.startsWith(DECLINE_PREFIX)) {
            throw new PaymentDeclinedException(
                    "목 PG가 거절했습니다",
                    "{\"mock\":true,\"code\":\"REJECT_CARD_COMPANY\",\"orderId\":\"%s\"}".formatted(orderId));
        }
        if (paymentKey.startsWith(TIMEOUT_PREFIX)) {
            throw new PaymentGatewayTimeoutException("목 PG 타임아웃", null);
        }
        log.info("목 PG 승인 — orderId={} amount={}", orderId, amount);
        return new PgApproval(
                paymentKey,
                clock.get(),
                "{\"mock\":true,\"status\":\"DONE\",\"orderId\":\"%s\",\"totalAmount\":%d}".formatted(orderId, amount));
    }
}
