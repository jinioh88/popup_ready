package com.popupready.server.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 상태 전이는 DB가 필요 없는 순수 도메인 규칙이다. 영속 계층에 얹어 검증하면
 * 컨텍스트 기동 비용만 들고 규칙이 어디에 있는지도 흐려진다.
 */
class ReservationRequestTest {

    private ReservationRequest sampleRequest() {
        LayoutDto layout = new LayoutDto(20, 12, 500, List.of(new LayoutItemDto(3L, 4, 2, 90)));
        return ReservationRequest.create(
                1L, 1L, LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 14), layout, 7_350_000L);
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
    @DisplayName("이미 CONTRACT_PENDING인 요청에 계약 생성 재시도 → 잘못된 전이로 거부한다")
    void markContractPending_whenAlreadyPending_isRejected() {
        ReservationRequest request = sampleRequest();
        request.markContractPending();

        assertThatThrownBy(request::markContractPending).isInstanceOf(IllegalStateException.class);
    }

    @Test
    @DisplayName("DRAFT에서 곧바로 서명 완료 시도 → 잘못된 전이로 거부한다")
    void markContractSigned_fromDraft_isRejected() {
        assertThatThrownBy(sampleRequest()::markContractSigned).isInstanceOf(IllegalStateException.class);
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
