package com.popupready.server.settlement;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 분할 정산 Row(US-203, §2.1). 1회 결제가 N개를 만든다.
 *
 * <p>{@code netAmount}는 <b>실제로 이체할 금액</b>이다. Sprint 3의 US-403 배치는 {@code net > 0}인
 * Row만 훑으면 되고, 플랫폼 Row의 net이 0인 것은 누락이 아니라 이체 대상이 아니라는 뜻이다.
 *
 * <p>{@code settledAt}은 이번 스프린트 내내 null이다 — 실제 이체·환불은 US-403의 몫이다.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Settlement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long paymentId;

    @Column(nullable = false)
    private Long payeeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SettlementType type;

    @Column(nullable = false)
    private long grossAmount;

    @Column(nullable = false)
    private long feeAmount;

    @Column(nullable = false)
    private long netAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SettlementStatus status;

    /** 이체 완료 시각. Sprint 3 배치가 채운다. */
    private Instant settledAt;

    private Settlement(Long paymentId, SettlementRow row) {
        this.paymentId = paymentId;
        this.payeeId = row.payeeId();
        this.type = row.type();
        this.grossAmount = row.grossAmount();
        this.feeAmount = row.feeAmount();
        this.netAmount = row.netAmount();
        this.status = row.status();
    }

    public static Settlement of(Long paymentId, SettlementRow row) {
        return new Settlement(paymentId, row);
    }

    public SettlementResponse toResponse() {
        return new SettlementResponse(type, payeeId, grossAmount, feeAmount, netAmount, status);
    }
}
