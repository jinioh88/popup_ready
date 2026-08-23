package com.popupready.server.door;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/**
 * 도어를 열 수 있는 시간창(US-301, §2.3).
 *
 * <p><b>게이트는 서버다.</b> "예약 시작 10분 전부터 활성화"의 판정을 클라이언트 시계에 맡기지
 * 않는다 — 기기 시계는 사용자가 바꿀 수 있고, 바꾸면 예약 전에 문이 열린다.
 *
 * <h2>현 스키마에서의 해석</h2>
 *
 * 백로그 인수 조건은 "예약 시작 10분 전"인데 {@code ReservationRequest}는 {@code LocalDate}만
 * 들고 있어 <b>시작 '시각'이 스키마에 없다</b>. 그래서 시작일이 시작되는 순간(자정)을 기준으로
 * 삼는다.
 *
 * <pre>
 * 열림 시작 = startDate 전날 23:50 (KST)
 * 열림 종료 = endDate 당일 24:00 직전 (KST)
 * </pre>
 *
 * <p><b>시간대를 {@code Asia/Seoul}로 고정</b>하는 것이 핵심이다. 서버 기본 시간대에 맡기면
 * 배포 환경이 UTC일 때 개방 시각이 9시간 어긋난다 — 그 오차는 "가끔 문이 안 열린다"로 나타나
 * 원인에 닿기 어렵다.
 *
 * <p>{@code Space}에 운영 시각을 추가하면 더 정확해지지만 그건 스키마·계약 변경이라 이번
 * 스코프 밖이다(Sprint 3 후보).
 */
public final class DoorWindow {

    /** 영업 기준 시간대. 서버 기본값에 맡기지 않는다. */
    private static final ZoneId ZONE = ZoneId.of("Asia/Seoul");

    /** 백로그 인수 조건 — 예약 시작 10분 전부터 활성화된다. */
    private static final Duration EARLY_ACCESS = Duration.ofMinutes(10);

    private DoorWindow() {}

    /**
     * @param now 판정 시각. 호출자가 주입하므로 시계 조작 없이 테스트된다
     */
    public static boolean isOpen(LocalDate startDate, LocalDate endDate, Instant now) {
        return !now.isBefore(opensAt(startDate)) && now.isBefore(closesAt(endDate));
    }

    /** 시작일 자정에서 10분을 당긴 순간. */
    public static Instant opensAt(LocalDate startDate) {
        return startDate.atStartOfDay(ZONE).toInstant().minus(EARLY_ACCESS);
    }

    /**
     * 종료일 <b>다음 날</b> 자정. 종료일 당일 23:59:59까지 열려 있어야 하므로 경계는 배타적이다 —
     * 종료일 자정으로 잡으면 마지막 날 하루가 통째로 닫힌다.
     */
    public static Instant closesAt(LocalDate endDate) {
        return endDate.plusDays(1).atStartOfDay(ZONE).toInstant();
    }
}
