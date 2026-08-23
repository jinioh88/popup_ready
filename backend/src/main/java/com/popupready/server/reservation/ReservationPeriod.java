package com.popupready.server.reservation;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * 공간을 쓰는 기간. <b>일수는 양끝을 포함한다</b> — 9/1~9/14는 14일이고 당일 사용은 1일이다
 * (스프린트 문서 §2.2 견적 계산 규약).
 *
 * <p>기간 규칙이 서비스와 견적 계산 두 곳에 흩어지지 않도록 여기서 한 번만 막는다.
 * 생성에 성공한 기간은 언제나 유효하므로, 이후 계산은 순서도 길이도 다시 의심할 필요가 없다.
 */
public record ReservationPeriod(LocalDate startDate, LocalDate endDate) {

    /**
     * 사용 기간 상한(일). <b>법률 세이프가드다</b> — 상가건물 임대차보호법상 일시사용 임대차로
     * 인정받는 요건의 핵심이 단기성이고, 그 위에 계약갱신요구권 배제(US-202)가 서 있다.
     * US-202 템플릿의 "30일 이내 권장"을 시스템이 게이트로 보증하는 쪽으로 PM이 결정했다
     * (2026-08-23). <b>이 값을 임의로 올리지 말 것</b> — 올리는 순간 계약의 법적 성격이 흔들린다.
     */
    public static final int MAX_DAYS = 30;

    public static ReservationPeriod of(LocalDate startDate, LocalDate endDate) {
        if (endDate.isBefore(startDate)) {
            throw new ApiException(
                    ErrorCode.VALIDATION_FAILED,
                    "endDate는 startDate와 같거나 이후여야 합니다 (%s ~ %s)".formatted(startDate, endDate));
        }
        // 일수를 세기 전에 날짜로 먼저 거른다. 9999년까지 요청해도 int 캐스팅이 넘치지 않는다.
        if (startDate.plusDays(MAX_DAYS - 1L).isBefore(endDate)) {
            throw new ApiException(
                    ErrorCode.VALIDATION_FAILED,
                    "사용 기간은 %d일을 넘을 수 없습니다 (%s ~ %s)".formatted(MAX_DAYS, startDate, endDate));
        }
        return new ReservationPeriod(startDate, endDate);
    }

    /** 양끝을 포함한 대여 일수. */
    public int days() {
        return (int) ChronoUnit.DAYS.between(startDate, endDate) + 1;
    }
}
