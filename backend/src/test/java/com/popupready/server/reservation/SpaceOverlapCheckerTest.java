package com.popupready.server.reservation;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 기간 겹침 판정 <b>한 벌</b>을 잠근다. 예약 생성(조기 안내)과 결제 승인(최종 판정)이 같은
 * 메서드를 부르므로, 두 시점의 결론이 갈릴 수 없다는 것이 이 테스트가 지키는 성질이다.
 *
 * <p>판정식(맞닿음·PAID만·자기 제외) 자체는 {@link PaidOverlapQueryTest}가 DB 대상으로 잠근다.
 * 여기서 보는 것은 <b>무엇을 조회에 넘기고 참일 때 무엇을 던지는가</b>이다.
 */
@ExtendWith(MockitoExtension.class)
class SpaceOverlapCheckerTest {

    private static final Long SPACE_ID = 23L;

    private static final LocalDate START = LocalDate.of(2026, 8, 26);

    private static final LocalDate END = LocalDate.of(2026, 9, 8);

    @Mock
    private ReservationRequestRepository reservationRequestRepository;

    @InjectMocks
    private SpaceOverlapChecker spaceOverlapChecker;

    @Test
    @DisplayName("겹치는 PAID 예약이 있음 → SPACE_ALREADY_BOOKED로 거절")
    void overlapping_isRejectedWithSpaceAlreadyBooked() {
        given(reservationRequestRepository.existsPaidOverlapping(SPACE_ID, START, END, 5L))
                .willReturn(true);

        assertThatThrownBy(() -> spaceOverlapChecker.requireNoOverlap(SPACE_ID, START, END, 5L))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.SPACE_ALREADY_BOOKED);
    }

    @Test
    @DisplayName("겹치는 PAID 예약이 없음 → 통과")
    void noOverlap_passes() {
        given(reservationRequestRepository.existsPaidOverlapping(SPACE_ID, START, END, 5L))
                .willReturn(false);

        assertThatCode(() -> spaceOverlapChecker.requireNoOverlap(SPACE_ID, START, END, 5L))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("아직 저장 전이라 제외할 예약이 없음(null) → 어떤 행과도 같지 않은 ID로 조회한다")
    void nullExcludeId_excludesNothing() {
        // null을 그대로 넘기면 `r.id <> :excludeId`가 null로 평가돼 모든 행이 걸러진다 —
        // 겹치는 예약이 있어도 항상 통과하는, 조용히 무력해진 검사가 된다.
        spaceOverlapChecker.requireNoOverlap(SPACE_ID, START, END, null);

        verify(reservationRequestRepository).existsPaidOverlapping(SPACE_ID, START, END, -1L);
    }
}
