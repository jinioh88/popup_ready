package com.popupready.server.reservation;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * 공간을 쓰는 기간. <b>일수는 양끝을 포함한다</b> — 9/1~9/14는 14일이고 당일 사용은 1일이다
 * (스프린트 문서 §2.2 견적 계산 규약).
 *
 * <p>날짜 순서 규칙이 서비스와 견적 계산 두 곳에 흩어지지 않도록 여기서 한 번만 막는다.
 * 생성에 성공한 기간은 언제나 유효하므로, 이후 계산은 순서를 다시 의심할 필요가 없다.
 */
public record ReservationPeriod(LocalDate startDate, LocalDate endDate) {

    public static ReservationPeriod of(LocalDate startDate, LocalDate endDate) {
        if (endDate.isBefore(startDate)) {
            throw new ApiException(
                    ErrorCode.VALIDATION_FAILED,
                    "endDate는 startDate와 같거나 이후여야 합니다 (%s ~ %s)".formatted(startDate, endDate));
        }
        return new ReservationPeriod(startDate, endDate);
    }

    /** 양끝을 포함한 대여 일수. */
    public int days() {
        return (int) ChronoUnit.DAYS.between(startDate, endDate) + 1;
    }
}
