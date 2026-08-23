package com.popupready.server.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 견적 계산 규약(스프린트 문서 §2.2, 2026-08-22 확정). 웹의 {@code app/lib/builder/estimate.ts}와
 * <b>한 글자도 다르지 않게</b> 구현해야 한다 — 갈라지면 결제 직전에 드러난다.
 *
 * <pre>
 * days               = 종료일 - 시작일 + 1
 * spaceRentTotal     = days × dailyRent
 * fixtureRentalTotal = days × Σ(배치된 집기의 dailyRentalFee)
 * deposit            = round(spaceRentTotal × depositRate)   // 원 단위 HALF_UP
 * totalAmount        = spaceRentTotal + fixtureRentalTotal + deposit
 * </pre>
 */
class EstimateCalculatorTest {

    private static final LocalDate START = LocalDate.of(2026, 9, 1);

    private static final LocalDate END = LocalDate.of(2026, 9, 14);

    private static final BigDecimal RATE_10_PERCENT = new BigDecimal("0.10");

    /** 일 렌털료 합계가 30,000원이 되는 집기 3종. 14일이면 420,000원이다. */
    private static final List<FixtureSpec> THREE_FIXTURES = List.of(
            new FixtureSpec(3L, 1_200, 500, 0, 12_000L, 40),
            new FixtureSpec(5L, 900, 600, 0, 15_000L, 10),
            new FixtureSpec(7L, 400, 400, 0, 3_000L, 50));

    private static EstimateResponse estimate(
            LocalDate start, LocalDate end, long dailyRent, BigDecimal rate, List<FixtureSpec> fixtures) {
        return EstimateCalculator.calculate(ReservationPeriod.of(start, end), dailyRent, rate, fixtures);
    }

    @Test
    @DisplayName("규약의 검증 예시(14일·450,000원·집기 420,000원) → 합계 7,350,000원")
    void calculate_contractExample_matchesAgreedNumbers() {
        EstimateResponse estimate = estimate(START, END, 450_000L, RATE_10_PERCENT, THREE_FIXTURES);

        assertThat(estimate).isEqualTo(new EstimateResponse(14, 6_300_000L, 420_000L, 630_000L, 7_350_000L));
    }

    @Test
    @DisplayName("집기를 하나도 배치하지 않음 → 집기 렌털료는 0이고 나머지는 그대로다")
    void calculate_withoutFixtures_hasZeroFixtureTotal() {
        EstimateResponse estimate = estimate(START, END, 450_000L, RATE_10_PERCENT, List.of());

        assertThat(estimate.fixtureRentalTotal()).isZero();
        assertThat(estimate.totalAmount()).isEqualTo(6_930_000L);
    }

    @Test
    @DisplayName("같은 집기를 2개 배치 → 렌털료를 2번 더한다")
    void calculate_duplicateFixtures_countsEach() {
        FixtureSpec hanger = new FixtureSpec(3L, 1_200, 500, 0, 12_000L, 40);

        EstimateResponse estimate = estimate(START, START, 100_000L, RATE_10_PERCENT, List.of(hanger, hanger));

        assertThat(estimate.fixtureRentalTotal()).isEqualTo(24_000L);
    }

    @Test
    @DisplayName("보증금 기준은 공간 대여료뿐 → 집기 렌털료가 커져도 보증금은 그대로다")
    void calculate_depositIgnoresFixtureRental() {
        FixtureSpec expensive = new FixtureSpec(9L, 1_000, 1_000, 0, 1_000_000L, 5);

        EstimateResponse withFixture = estimate(START, END, 450_000L, RATE_10_PERCENT, List.of(expensive));
        EstimateResponse withoutFixture = estimate(START, END, 450_000L, RATE_10_PERCENT, List.of());

        assertThat(withFixture.deposit()).isEqualTo(withoutFixture.deposit());
    }

    @Test
    @DisplayName("보증금이 소수로 떨어짐 → 원 단위 HALF_UP으로 올린다")
    void calculate_depositRoundsHalfUp() {
        // 3일 × 333,333 = 999,999 → × 0.10 = 99,999.9 → 100,000
        EstimateResponse estimate = estimate(START, START.plusDays(2), 333_333L, RATE_10_PERCENT, List.of());

        assertThat(estimate.deposit()).isEqualTo(100_000L);
    }

    @Test
    @DisplayName("보증금이 정확히 0.5원 → HALF_UP이므로 올린다(내림·짝수 반올림과 갈라지는 경계)")
    void calculate_depositExactlyHalf_roundsUp() {
        EstimateResponse estimate = estimate(START, START, 1L, new BigDecimal("0.5"), List.of());

        assertThat(estimate.deposit()).isEqualTo(1L);
    }

    @Test
    @DisplayName("당일 사용 → 일수 1로 계산한다")
    void calculate_sameDay_usesOneDay() {
        EstimateResponse estimate = estimate(START, START, 450_000L, RATE_10_PERCENT, THREE_FIXTURES);

        assertThat(estimate.days()).isEqualTo(1);
        assertThat(estimate.spaceRentTotal()).isEqualTo(450_000L);
        assertThat(estimate.fixtureRentalTotal()).isEqualTo(30_000L);
    }

    @Test
    @DisplayName("총액 → 공간 대여료·집기 렌털료·보증금의 합이다")
    void calculate_totalIsSumOfParts() {
        EstimateResponse estimate = estimate(START, END, 450_000L, RATE_10_PERCENT, THREE_FIXTURES);

        assertThat(estimate.totalAmount())
                .isEqualTo(estimate.spaceRentTotal() + estimate.fixtureRentalTotal() + estimate.deposit());
    }
}
