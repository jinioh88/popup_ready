package com.popupready.server.door;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 도어 이벤트의 상태 전이(T4-1). DB가 필요 없어 순수 단위 테스트한다. */
class DoorEventTest {

    private static final Instant AUTHORIZED_AT = Instant.parse("2026-09-01T00:50:00Z");

    private static final Instant ACKED_AT = Instant.parse("2026-09-01T00:50:02Z");

    private static DoorEvent authorized() {
        return DoorEvent.authorize(45L, 7L, "popupready/locks/1/command", AUTHORIZED_AT);
    }

    @Test
    @DisplayName("승인 직후 → AUTHORIZED이고 아직 마감되지 않았다")
    void authorize_startsAsAuthorized() {
        DoorEvent event = authorized();

        assertThat(event.getStatus()).isEqualTo(DoorEventStatus.AUTHORIZED);
        assertThat(event.getAckedAt()).isNull();
    }

    @Test
    @DisplayName("발행 성공 보고 → DELIVERED로 마감되고 시각이 남는다")
    void ack_success_marksDelivered() {
        DoorEvent event = authorized();

        event.ack(true, ACKED_AT);

        assertThat(event.getStatus()).isEqualTo(DoorEventStatus.DELIVERED);
        assertThat(event.getAckedAt()).isEqualTo(ACKED_AT);
    }

    @Test
    @DisplayName("발행 실패 보고 → FAILED로 마감된다(성공으로 위장하지 않는다)")
    void ack_failure_marksFailed() {
        DoorEvent event = authorized();

        event.ack(false, ACKED_AT);

        assertThat(event.getStatus()).isEqualTo(DoorEventStatus.FAILED);
    }

    @Test
    @DisplayName("이미 마감된 이벤트를 다시 ack → 거절한다")
    void ack_alreadyClosed_isRejected() {
        // 재-ack을 허용하면 실패로 마감된 기록을 나중에 성공으로 덮어쓸 수 있다.
        // 전송 기록은 한 번 정해지면 바뀌지 않아야 증거가 된다.
        DoorEvent event = authorized();
        event.ack(false, ACKED_AT);

        assertThatThrownBy(() -> event.ack(true, ACKED_AT.plusSeconds(10))).isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("이벤트는 자기 예약·요청자를 기억한다 → ack 인가의 근거가 된다")
    void authorize_remembersOwner() {
        DoorEvent event = authorized();

        assertThat(event.getReservationRequestId()).isEqualTo(45L);
        assertThat(event.getUserId()).isEqualTo(7L);
    }
}
