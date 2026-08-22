package com.popupready.server.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 대여 기간. 일수는 <b>양끝 포함</b>이다(스프린트 문서 §2.2 견적 계산 규약). */
class ReservationPeriodTest {

    @Test
    @DisplayName("9/1~9/14 → 양끝을 포함해 14일이다")
    void days_countsBothEnds() {
        ReservationPeriod period = ReservationPeriod.of(LocalDate.of(2026, 9, 1), LocalDate.of(2026, 9, 14));

        assertThat(period.days()).isEqualTo(14);
    }

    @Test
    @DisplayName("시작일과 종료일이 같음(당일 사용) → 1일이다")
    void days_sameDay_isOne() {
        LocalDate day = LocalDate.of(2026, 9, 1);

        assertThat(ReservationPeriod.of(day, day).days()).isEqualTo(1);
    }

    @Test
    @DisplayName("달을 넘기는 기간 → 실제 달력 일수를 센다")
    void days_acrossMonths_usesCalendar() {
        // 9월은 30일까지다. 9/29·9/30·10/1 = 3일.
        ReservationPeriod period = ReservationPeriod.of(LocalDate.of(2026, 9, 29), LocalDate.of(2026, 10, 1));

        assertThat(period.days()).isEqualTo(3);
    }

    @Test
    @DisplayName("종료일이 시작일보다 이름 → 400으로 거부한다")
    void of_endBeforeStart_isRejected() {
        assertThatThrownBy(() -> ReservationPeriod.of(LocalDate.of(2026, 9, 14), LocalDate.of(2026, 9, 1)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }
}
