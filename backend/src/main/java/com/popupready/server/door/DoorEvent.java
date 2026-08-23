package com.popupready.server.door;

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
 * 도어 오픈 이벤트(US-301, §2.1).
 *
 * <p>이 기록이 두 단계로 나뉘어 있는 것이 요점이다 — <b>승인({@code AUTHORIZED})은 "열어도 된다"이지
 * "열었다"가 아니다.</b> 실제 발행은 모바일이 하므로, 발행 결과를 되받아({@code ack}) 마감해야
 * 비로소 전송 기록이 된다. ①만으로 기록을 끝내면 publish 실패가 성공으로 위장된다.
 *
 * <p>{@code reservationRequestId}·{@code userId}는 타 도메인 식별자를 스칼라로만 들고 있다 —
 * 연관관계로 묶으면 패키지 경계 규칙이 깨진다. 이 둘은 <b>ack 인가의 근거</b>이기도 하다:
 * 남의 이벤트를 마감할 수 있으면 전송 기록을 위조하는 경로가 된다.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DoorEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long reservationRequestId;

    /** 개방을 요청한 사용자. ack는 이 사람만 할 수 있다. */
    @Column(nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DoorEventStatus status;

    @Column(nullable = false)
    private Instant authorizedAt;

    /** 발행 결과를 되받은 시각. 마감 전에는 null이다. */
    private Instant ackedAt;

    /** 서버가 내려준 발행 토픽. 무엇을 열라고 했는지가 기록에 남아야 분쟁 시 대조된다. */
    @Column(nullable = false)
    private String topic;

    private DoorEvent(Long reservationRequestId, Long userId, String topic, Instant authorizedAt) {
        this.reservationRequestId = reservationRequestId;
        this.userId = userId;
        this.topic = topic;
        this.authorizedAt = authorizedAt;
        this.status = DoorEventStatus.AUTHORIZED;
    }

    public static DoorEvent authorize(Long reservationRequestId, Long userId, String topic, Instant authorizedAt) {
        return new DoorEvent(reservationRequestId, userId, topic, authorizedAt);
    }

    /**
     * 모바일이 보고한 발행 결과로 마감한다.
     *
     * <p><b>재-ack은 거절한다.</b> 허용하면 실패로 마감된 기록을 나중에 성공으로 덮어쓸 수 있고,
     * 그러면 전송 기록이 증거이기를 그만둔다.
     */
    public void ack(boolean success, Instant ackedAt) {
        if (status != DoorEventStatus.AUTHORIZED) {
            throw new IllegalStateException("이미 마감된 도어 이벤트입니다 (현재 상태: %s)".formatted(status));
        }
        this.status = success ? DoorEventStatus.DELIVERED : DoorEventStatus.FAILED;
        this.ackedAt = ackedAt;
    }

    /** 이 이벤트를 마감할 자격이 있는가. 개방을 요청한 본인만이다. */
    public boolean isOwnedBy(long candidateUserId) {
        return userId == candidateUserId;
    }
}
