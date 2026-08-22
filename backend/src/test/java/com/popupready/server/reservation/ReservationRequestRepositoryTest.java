package com.popupready.server.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;

/** 영속 왕복만 확인한다. 상태 전이는 DB가 필요 없어 {@link ReservationRequestTest}가 맡는다. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class ReservationRequestRepositoryTest {

    @Autowired
    private ReservationRequestRepository reservationRequestRepository;

    private ReservationRequest sampleRequest() {
        LayoutDto layout = new LayoutDto(20, 12, 500, List.of(new LayoutItemDto(3L, 4, 2, 90)));
        return ReservationRequest.create(
                1L, 1L, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 14), layout, 7_350_000L);
    }

    @Test
    @DisplayName("예약 요청 저장 → 식별자가 부여되고 조회로 왕복된다")
    void save_assignsIdAndRoundTrips() {
        ReservationRequest saved = reservationRequestRepository.save(sampleRequest());

        assertThat(saved.getId()).isNotNull();
        assertThat(reservationRequestRepository.findById(saved.getId())).get().satisfies(found -> {
            assertThat(found.getSpaceId()).isEqualTo(1L);
            assertThat(found.getTotalEstimate()).isEqualTo(7_350_000L);
        });
    }

    @Test
    @DisplayName("JSONB 레이아웃 저장 → 배치 항목이 그대로 왕복된다")
    void save_roundTripsLayoutAsJsonb() {
        ReservationRequest saved = reservationRequestRepository.save(sampleRequest());

        LayoutDto layout = reservationRequestRepository
                .findById(saved.getId())
                .orElseThrow()
                .getLayout();
        assertThat(layout.gridCols()).isEqualTo(20);
        assertThat(layout.items()).singleElement().satisfies(item -> {
            assertThat(item.fixtureId()).isEqualTo(3L);
            assertThat(item.rotation()).isEqualTo(90);
        });
    }
}
