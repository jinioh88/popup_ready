package com.popupready.server.reservation;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * 견적 계산(스프린트 문서 §2.2 "견적 계산 규약", 2026-08-22 확정). 웹의
 * {@code app/lib/builder/estimate.ts}와 <b>같은 식</b>이어야 한다 — 화면 금액과 서버 금액이
 * 갈라지면 결제 직전에 드러난다.
 *
 * <p>산식과 보증금 기준의 근거는 {@link EstimateResponse} 문서에 적혀 있다. 요지는 둘이다:
 * <b>보증금 기준은 공간 대여료뿐</b>이고, <b>반올림은 보증금 한 곳에서만</b> 일어난다.
 */
public final class EstimateCalculator {

    private EstimateCalculator() {}

    /**
     * @param placedFixtures 배치된 집기의 규격. 같은 집기를 2개 놓았으면 두 번 들어온다
     */
    public static EstimateResponse calculate(
            ReservationPeriod period, long dailyRent, BigDecimal depositRate, List<FixtureSpec> placedFixtures) {
        int days = period.days();
        long dailyFixtureFee =
                placedFixtures.stream().mapToLong(FixtureSpec::dailyRentalFee).sum();

        long spaceRentTotal = days * dailyRent;
        long fixtureRentalTotal = days * dailyFixtureFee;
        long deposit = deposit(spaceRentTotal, depositRate);

        return new EstimateResponse(
                days, spaceRentTotal, fixtureRentalTotal, deposit, spaceRentTotal + fixtureRentalTotal + deposit);
    }

    /**
     * 보증금은 공간 대여료에만 비율을 곱해 원 단위 HALF_UP으로 맺는다.
     *
     * <p>비율이 소수라 {@code double}로 곱하면 0.1처럼 이진수로 떨어지지 않는 값에서 반올림 경계가
     * 1원 어긋날 수 있다. 그래서 십진 연산({@link BigDecimal})으로만 계산한다.
     */
    private static long deposit(long spaceRentTotal, BigDecimal depositRate) {
        return BigDecimal.valueOf(spaceRentTotal)
                .multiply(depositRate)
                .setScale(0, RoundingMode.HALF_UP)
                .longValueExact();
    }
}
