package com.popupready.server.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import com.popupready.server.fixture.FixtureCategory;
import com.popupready.server.fixture.FixtureResponse;
import com.popupready.server.fixture.FixtureService;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 가용 수량 조립. 집계 자체는 {@link FixtureUsageQueryTest}가 로컬 PostGIS로 잠그므로
 * 여기서는 <b>뺄셈과 목록 구성</b>만 본다.
 */
@ExtendWith(MockitoExtension.class)
class FixtureAvailabilityServiceTest {

    private static final ReservationPeriod PERIOD =
            ReservationPeriod.of(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 14));

    @Mock
    private FixtureService fixtureService;

    @Mock
    private ReservationRequestRepository reservationRequestRepository;

    @InjectMocks
    private FixtureAvailabilityService fixtureAvailabilityService;

    private static FixtureResponse fixture(long id, int stockQty) {
        return new FixtureResponse(id, "행거", FixtureCategory.HANGER, 900, 600, 0, 30_000L, stockQty);
    }

    private record Usage(Long fixtureId, Integer reservedQty) implements FixtureUsage {
        @Override
        public Long getFixtureId() {
            return fixtureId;
        }

        @Override
        public Integer getReservedQty() {
            return reservedQty;
        }
    }

    @Test
    @DisplayName("잡힌 수량이 있는 집기 → 총재고에서 뺀 만큼이 가용량이다")
    void availability_subtractsReservedFromStock() {
        given(fixtureService.list(null)).willReturn(List.of(fixture(1L, 10)));
        given(reservationRequestRepository.reservedQuantities(any(), any())).willReturn(List.of(new Usage(1L, 3)));

        assertThat(fixtureAvailabilityService.availability(PERIOD))
                .singleElement()
                .satisfies(row -> {
                    assertThat(row.reservedQty()).isEqualTo(3);
                    assertThat(row.availableQty()).isEqualTo(7);
                });
    }

    @Test
    @DisplayName("아무도 잡지 않은 집기 → 목록에서 빠지지 않고 가용량이 총재고다")
    void availability_includesUntouchedFixtures() {
        // 집계 쿼리는 잡힌 집기만 돌려준다. 그것만 내보내면 빌더 팔레트가 나머지를 그리지 못한다.
        given(fixtureService.list(null)).willReturn(List.of(fixture(1L, 10), fixture(2L, 4)));
        given(reservationRequestRepository.reservedQuantities(any(), any())).willReturn(List.of(new Usage(1L, 3)));

        assertThat(fixtureAvailabilityService.availability(PERIOD))
                .extracting(FixtureAvailabilityResponse::fixtureId, FixtureAvailabilityResponse::availableQty)
                .containsExactly(
                        org.assertj.core.groups.Tuple.tuple(1L, 7), org.assertj.core.groups.Tuple.tuple(2L, 4));
    }

    @Test
    @DisplayName("재고보다 많이 잡혀 있으면 → 가용량은 음수가 아니라 0이다")
    void availability_neverGoesNegative() {
        // 재고를 줄였는데 이미 잡힌 예약이 그보다 많으면 실제로 일어난다. 음수를 그대로 내보내면
        // 웹의 '남은 수량'이 -2가 되고 클라이언트마다 다르게 해석한다.
        given(fixtureService.list(null)).willReturn(List.of(fixture(1L, 2)));
        given(reservationRequestRepository.reservedQuantities(any(), any())).willReturn(List.of(new Usage(1L, 5)));

        assertThat(fixtureAvailabilityService.availability(PERIOD))
                .singleElement()
                .satisfies(row -> {
                    assertThat(row.reservedQty()).as("잡힌 수량은 사실대로 보여준다").isEqualTo(5);
                    assertThat(row.availableQty()).isZero();
                });
    }
}
