package com.popupready.server.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * 같은 공간·겹치는 기간에 이미 결제된 예약이 있는가(§2.2-C 2-2).
 *
 * <p>이 판정이 이중 예약의 마지막 관문이다. <b>락 키에서 기간을 뺀 이유</b>이기도 하다 —
 * 기간이 키에 들어가면 A[9/01~9/05]와 B[9/03~9/07]가 서로 다른 락을 잡아 이 확인을
 * 나란히 통과한다.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class PaidOverlapQueryTest {

    private static final long SPACE = 1L;

    @Autowired
    private ReservationRequestRepository repository;

    @BeforeEach
    void clear() {
        repository.deleteAll();
    }

    private Long paid(long spaceId, LocalDate start, LocalDate end) {
        return save(spaceId, start, end, ReservationStatus.PAID);
    }

    private Long save(long spaceId, LocalDate start, LocalDate end, ReservationStatus status) {
        ReservationRequest request = ReservationRequest.create(
                spaceId,
                1L,
                start,
                end,
                new LayoutDto(20, 12, 500, List.of()),
                new EstimateResponse(1, 1000L, 0L, 100L, 1100L));
        ReflectionTestUtils.setField(request, "status", status);
        return repository.save(request).getId();
    }

    private boolean overlaps(LocalDate start, LocalDate end, Long excludeId) {
        return repository.existsPaidOverlapping(SPACE, start, end, excludeId);
    }

    @Test
    @DisplayName("겹치는 PAID 예약이 있으면 → 참")
    void overlappingPaid_isDetected() {
        paid(SPACE, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 5));

        assertThat(overlaps(LocalDate.of(2026, 9, 3), LocalDate.of(2026, 9, 7), -1L))
                .isTrue();
    }

    @Test
    @DisplayName("맞닿기만 하는 기간 → 겹침이 아니다")
    void adjacentPeriods_doNotOverlap() {
        // 9/05 종료와 9/06 시작은 겹치지 않는다. 여기서 겹친다고 하면 연속 예약이 막힌다.
        paid(SPACE, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 5));

        assertThat(overlaps(LocalDate.of(2026, 9, 6), LocalDate.of(2026, 9, 10), -1L))
                .isFalse();
    }

    @Test
    @DisplayName("PAID가 아닌 예약 → 겹침으로 세지 않는다")
    void nonPaidReservation_doesNotBlock() {
        // 결제 전 예약이 자리를 잡으면 결제하지 않은 요청이 남의 예약을 막는다.
        save(SPACE, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 5), ReservationStatus.CONTRACT_SIGNED);

        assertThat(overlaps(LocalDate.of(2026, 9, 3), LocalDate.of(2026, 9, 7), -1L))
                .isFalse();
    }

    @Test
    @DisplayName("다른 공간의 PAID 예약 → 겹침이 아니다")
    void otherSpace_doesNotBlock() {
        paid(99L, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 5));

        assertThat(overlaps(LocalDate.of(2026, 9, 3), LocalDate.of(2026, 9, 7), -1L))
                .isFalse();
    }

    @Test
    @DisplayName("🚨 자기 자신은 겹침에서 제외된다")
    void selfIsExcluded() {
        // 승인 경로는 이미 PAID인 예약을 다시 확인하는 일이 없지만, 제외하지 않으면
        // 재확인 로직을 어디서든 재사용할 때 자기 자신 때문에 항상 거절된다.
        Long id = paid(SPACE, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 5));

        assertThat(overlaps(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 5), id))
                .isFalse();
    }

    @Test
    @DisplayName("완전히 포함되는 기간 → 겹침이다")
    void containedPeriod_overlaps() {
        paid(SPACE, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 20));

        assertThat(overlaps(LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 7), -1L))
                .isTrue();
    }
}
