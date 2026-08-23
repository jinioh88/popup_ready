package com.popupready.server.payment;

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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 결제 시도(US-201, §2.1).
 *
 * <p><b>예약과 1:N이다</b>(2026-08-23 교정). 1:1로 두면 재시도가 같은 행을 덮어써
 * {@code rawResponse}의 분쟁 대비 목적과 양립하지 않는다. "예약당 {@code PAID}는 최대 1건"이
 * 실질 제약이며, 이는 분산 락과 승인 경로의 상태 재확인(§2.2-C 2-1)이 보장한다.
 *
 * <p>{@code orderId}는 시도마다 새로 발급되고 재사용하지 않는다 — 이미 승인 시도된 orderId는
 * PG가 거부할 수 있고, 재사용하면 "이전 시도가 실제로는 승인됐는데 응답만 유실된" 경우와
 * "정말 실패한" 경우를 구분할 수 없다.
 *
 * <p>상태 전이는 되돌릴 수 없다. 같은 시도를 나중에 다른 결과로 덮어쓸 수 있으면
 * {@code rawResponse}가 분쟁 자료이기를 그만둔다 — 재시도는 새 시도를 만든다.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long reservationRequestId;

    /** 토스 주문 ID. 시도마다 새로 발급되므로 유니크하다. */
    @Column(nullable = false, unique = true)
    private String orderId;

    /** 토스가 승인 시 발급한다. 승인 전에는 null이다. */
    private String paymentKey;

    /** 총 결제액(원). 요청 본문이 아니라 견적 스냅샷에서 온다(§2.2-E). */
    @Column(nullable = false)
    private long amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentStatus status;

    private Instant approvedAt;

    @Column(nullable = false)
    private Instant createdAt;

    /** PG 응답 원문. 분쟁 대비이며 타임아웃 사실도 여기 남는다. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String rawResponse;

    private Payment(Long reservationRequestId, String orderId, long amount, Instant createdAt) {
        this.reservationRequestId = reservationRequestId;
        this.orderId = orderId;
        this.amount = amount;
        this.createdAt = createdAt;
        this.status = PaymentStatus.READY;
    }

    /** 결제 준비 — 주문을 발급하고 위젯이 뜰 수 있게 한다. 아직 자리를 잡은 것이 아니다. */
    public static Payment ready(Long reservationRequestId, String orderId, long amount, Instant createdAt) {
        return new Payment(reservationRequestId, orderId, amount, createdAt);
    }

    public void approve(String paymentKey, Instant approvedAt, String rawResponse) {
        requireReady(PaymentStatus.PAID);
        this.paymentKey = paymentKey;
        this.approvedAt = approvedAt;
        this.rawResponse = rawResponse;
        this.status = PaymentStatus.PAID;
    }

    /** PG가 거절했다. 거절 응답도 보관한다 — 왜 막혔는지는 분쟁에서 먼저 묻는 것이다. */
    public void fail(String rawResponse) {
        requireReady(PaymentStatus.FAILED);
        this.rawResponse = rawResponse;
        this.status = PaymentStatus.FAILED;
    }

    /**
     * PG 호출이 타임아웃돼 승인 여부를 모른다.
     *
     * <p>{@code FAILED}로 적지 않는 이유는 "PG는 승인했는데 우리는 실패로 안다"가 조용해지기
     * 때문이다. 자동 대사는 Sprint 3 범위이며, 여기서는 <b>수동 확인이 가능한 흔적</b>까지 남긴다.
     */
    public void markUnknown(String reason) {
        requireReady(PaymentStatus.UNKNOWN);
        // rawResponse는 JSONB다. 평문을 넣으면 flush 시점에 invalid input syntax for type json이
        // 나고, 그 예외는 500으로 새어나가 "PG 타임아웃"이 "서버 장애"로 보인다 — 실서버에서
        // 실제로 그랬다. 사유는 우리가 만든 문자열이므로 여기서 JSON으로 감싼다.
        this.rawResponse = "{\"timeout\":true,\"reason\":" + jsonString(reason) + "}";
        this.status = PaymentStatus.UNKNOWN;
    }

    /**
     * 문자열을 JSON 리터럴로 감싼다. 사유 메시지에 따옴표나 역슬래시가 섞여도 JSONB가 거부하지
     * 않게 한다 — PG 메시지를 그대로 옮기는 자리라 무엇이 들어올지 정하지 않는다.
     */
    private static String jsonString(String value) {
        StringBuilder out = new StringBuilder("\"");
        for (char c : String.valueOf(value).toCharArray()) {
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (c < 0x20) {
                        out.append(String.format("\\u%04x", (int) c));
                    } else {
                        out.append(c);
                    }
                }
            }
        }
        return out.append('"').toString();
    }

    public void cancel(String rawResponse) {
        if (status != PaymentStatus.PAID) {
            throw new IllegalStateException("승인된 결제만 취소할 수 있습니다 (현재 상태: %s)".formatted(status));
        }
        this.rawResponse = rawResponse;
        this.status = PaymentStatus.CANCELLED;
    }

    private void requireReady(PaymentStatus target) {
        if (status != PaymentStatus.READY) {
            throw new IllegalStateException("%s → %s 전이는 허용되지 않는다 (READY에서만 가능)".formatted(status, target));
        }
    }
}
