package com.popupready.server.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;

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

    @Test
    @DisplayName("새 예약 요청 → 상태는 DRAFT로 시작한다")
    void create_startsAsDraft() {
        assertThat(sampleRequest().getStatus()).isEqualTo(ReservationStatus.DRAFT);
    }

    @Test
    @DisplayName("DRAFT에서 계약 생성 → CONTRACT_PENDING으로 전이한다")
    void markContractPending_movesFromDraft() {
        ReservationRequest request = sampleRequest();

        request.markContractPending();

        assertThat(request.getStatus()).isEqualTo(ReservationStatus.CONTRACT_PENDING);
    }

    @Test
    @DisplayName("DRAFT에서 곧바로 서명 완료 시도 → 잘못된 전이로 거부한다")
    void markContractSigned_fromDraft_isRejected() {
        ReservationRequest request = sampleRequest();

        assertThatThrownBy(request::markContractSigned).isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("CONTRACT_PENDING에서 서명 완료 → CONTRACT_SIGNED로 전이한다")
    void markContractSigned_fromContractPending_succeeds() {
        ReservationRequest request = sampleRequest();
        request.markContractPending();

        request.markContractSigned();

        assertThat(request.getStatus()).isEqualTo(ReservationStatus.CONTRACT_SIGNED);
    }
}
