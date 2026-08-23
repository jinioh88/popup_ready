package com.popupready.server.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.test.util.ReflectionTestUtils;

/**
 * 날짜별 집기 점유 집계(T1-2). <b>로컬 PostGIS 대상</b>이다 — 집계가 JSONB 펼치기와
 * {@code generate_series}에 기대고 있어 H2로 대체되지 않는다.
 *
 * <p>이 집계가 잘못되면 증상이 조용하다. 과다 차감이면 멀쩡한 집기가 품절로 보이고, 과소 차감이면
 * 배치는 통과했다가 결제에서 409가 난다. 둘 다 "테스트는 초록인데 화면이 이상한" 모양이라
 * 경계 케이스를 여기서 못 박는다.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class FixtureUsageQueryTest {

    private static final long FIXTURE = 3L;

    private static final long OTHER_FIXTURE = 4L;

    @Autowired
    private ReservationRequestRepository repository;

    @BeforeEach
    void clear() {
        repository.deleteAll();
    }

    /** @param qty 같은 집기를 몇 개 놓았는가 — 견적과 마찬가지로 개수만큼 항목이 들어간다 */
    private void paidReservation(long spaceId, long fixtureId, int qty, LocalDate start, LocalDate end) {
        List<LayoutItemDto> items = java.util.stream.IntStream.range(0, qty)
                .mapToObj(i -> new LayoutItemDto(fixtureId, i, 0, 0))
                .toList();
        ReservationRequest request = ReservationRequest.create(
                spaceId,
                1L,
                start,
                end,
                new LayoutDto(20, 12, 500, items),
                new EstimateResponse(1, 1000L, 0L, 100L, 1100L));
        // 상태 전이 메서드는 결제 경로(Phase 2)에서 생긴다. 여기서 보려는 것은 집계이므로
        // 저장된 상태만 PAID로 맞춘다.
        ReflectionTestUtils.setField(request, "status", ReservationStatus.PAID);
        repository.save(request);
    }

    private Map<Long, Integer> reservedIn(LocalDate start, LocalDate end) {
        return repository.reservedQuantities(start, end).stream()
                .collect(java.util.stream.Collectors.toMap(
                        FixtureUsage::getFixtureId, FixtureUsage::getReservedQty, (a, b) -> a, java.util.HashMap::new));
    }

    @Test
    @DisplayName("기간이 겹치는 PAID 예약 → 그 집기 수량이 잡힌다")
    void overlappingPaidReservation_countsQuantity() {
        paidReservation(1L, FIXTURE, 2, LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 10));

        assertThat(reservedIn(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 14)))
                .containsEntry(FIXTURE, 2);
    }

    @Test
    @DisplayName("기간이 겹치지 않는 예약 → 세지 않는다")
    void nonOverlappingReservation_isIgnored() {
        paidReservation(1L, FIXTURE, 2, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 5));

        assertThat(reservedIn(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 14)))
                .doesNotContainKey(FIXTURE);
    }

    @Test
    @DisplayName("PAID가 아닌 예약 → 세지 않는다(아직 자리를 잡은 것이 아니다)")
    void nonPaidReservation_isIgnored() {
        ReservationRequest draft = ReservationRequest.create(
                1L,
                1L,
                LocalDate.of(2026, 9, 5),
                LocalDate.of(2026, 9, 10),
                new LayoutDto(20, 12, 500, List.of(new LayoutItemDto(FIXTURE, 0, 0, 0))),
                new EstimateResponse(1, 1000L, 0L, 100L, 1100L));
        repository.save(draft);

        assertThat(reservedIn(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 14)))
                .doesNotContainKey(FIXTURE);
    }

    @Test
    @DisplayName("🚨 날짜가 어긋나게 겹친 두 예약 → 합계가 아니라 가장 빡빡한 날 기준이다")
    void staggeredReservations_takeBusiestDayNotSum() {
        // 9/01~9/05에 2개, 9/10~9/15에 3개. 겹치는 날이 없으므로 어느 날도 5개가 되지 않는다.
        // 합계(5)로 세면 멀쩡한 집기가 품절로 보인다.
        paidReservation(1L, FIXTURE, 2, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 5));
        paidReservation(1L, FIXTURE, 3, LocalDate.of(2026, 9, 10), LocalDate.of(2026, 9, 15));

        assertThat(reservedIn(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 20)))
                .containsEntry(FIXTURE, 3);
    }

    @Test
    @DisplayName("🚨 같은 날 겹친 두 예약 → 그 날은 합산된다")
    void concurrentReservations_sumOnSharedDay() {
        // 9/05~9/07이 겹친다. 그 날 기준 2+3=5개가 잡혀 있다 —
        // 최댓값을 '예약 하나의 최대'로 오해하면 3이 나와 품절이 뚫린다.
        paidReservation(1L, FIXTURE, 2, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 7));
        paidReservation(1L, FIXTURE, 3, LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 12));

        assertThat(reservedIn(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 20)))
                .containsEntry(FIXTURE, 5);
    }

    @Test
    @DisplayName("🚨 다른 공간의 예약도 차감된다 — 집기는 공간에 매이지 않는다")
    void reservationInAnotherSpace_stillCounts() {
        // 공간별로 세면 서로 다른 공간의 두 예약이 같은 집기의 마지막 1개를 나눠 갖는다.
        paidReservation(99L, FIXTURE, 4, LocalDate.of(2026, 9, 5), LocalDate.of(2026, 9, 10));

        assertThat(reservedIn(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 14)))
                .containsEntry(FIXTURE, 4);
    }

    @Test
    @DisplayName("질의 기간 밖의 붐비는 날 → 결과에 섞이지 않는다")
    void busyDayOutsideQueryRange_isExcluded() {
        // 9/01~9/03에 5개, 9/20~9/25에 1개. 9/20~9/25만 물으면 답은 1이어야 한다.
        paidReservation(1L, FIXTURE, 5, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 3));
        paidReservation(1L, FIXTURE, 1, LocalDate.of(2026, 9, 20), LocalDate.of(2026, 9, 25));

        assertThat(reservedIn(LocalDate.of(2026, 9, 20), LocalDate.of(2026, 9, 25)))
                .containsEntry(FIXTURE, 1);
    }

    @Test
    @DisplayName("여러 집기가 섞인 배치 → 집기별로 따로 센다")
    void multipleFixtures_countedSeparately() {
        ReservationRequest request = ReservationRequest.create(
                1L,
                1L,
                LocalDate.of(2026, 9, 5),
                LocalDate.of(2026, 9, 10),
                new LayoutDto(
                        20,
                        12,
                        500,
                        List.of(
                                new LayoutItemDto(FIXTURE, 0, 0, 0),
                                new LayoutItemDto(FIXTURE, 1, 0, 0),
                                new LayoutItemDto(OTHER_FIXTURE, 2, 0, 0))),
                new EstimateResponse(1, 1000L, 0L, 100L, 1100L));
        ReflectionTestUtils.setField(request, "status", ReservationStatus.PAID);
        repository.save(request);

        assertThat(reservedIn(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 14)))
                .containsEntry(FIXTURE, 2)
                .containsEntry(OTHER_FIXTURE, 1);
    }

    @Test
    @DisplayName("집기가 없는 빈 배치 → 아무것도 세지 않는다")
    void emptyLayout_countsNothing() {
        ReservationRequest request = ReservationRequest.create(
                1L,
                1L,
                LocalDate.of(2026, 9, 5),
                LocalDate.of(2026, 9, 10),
                new LayoutDto(20, 12, 500, List.of()),
                new EstimateResponse(1, 1000L, 0L, 100L, 1100L));
        ReflectionTestUtils.setField(request, "status", ReservationStatus.PAID);
        repository.save(request);

        assertThat(reservedIn(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 14)))
                .isEmpty();
    }
}
