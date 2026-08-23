package com.popupready.server.door;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 도어 개방 시간창 판정(T4-2). 의존성 없는 순수 판정이라 스텁 없이 단위 테스트한다.
 *
 * <p><b>판정 권위는 서버다</b>(§2.3). 클라이언트 시계로 버튼을 켜고 끄는 것은 편의일 뿐이며
 * 실제 개방 여부는 여기서 갈린다.
 *
 * <p>백로그 인수 조건은 "예약 시작 10분 전부터"인데 {@code ReservationRequest}는
 * {@code LocalDate}만 들고 있어 <b>시작 '시각'이 스키마에 없다</b>. 현 스키마에서 일관된
 * 해석은 하나뿐이다 — 시작일이 시작되기 10분 전, 즉 전날 23:50(KST)부터 종료일 끝까지.
 */
class DoorWindowTest {

    private static final LocalDate START = LocalDate.of(2026, 9, 1);

    private static final LocalDate END = LocalDate.of(2026, 9, 14);

    /** KST 벽시계 시각을 Instant로. 판정은 순간으로 하지만 창의 기준은 영업 시간대다. */
    private static Instant kst(String isoLocalDateTime) {
        return LocalDateTime.parse(isoLocalDateTime)
                .atZone(ZoneId.of("Asia/Seoul"))
                .toInstant();
    }

    @Test
    @DisplayName("시작 10분 전 정각 → 열린다(경계는 허용이다)")
    void exactlyTenMinutesBeforeStart_isOpen() {
        assertThat(DoorWindow.isOpen(START, END, kst("2026-08-31T23:50:00"))).isTrue();
    }

    @Test
    @DisplayName("시작 11분 전 → 아직 열리지 않는다")
    void elevenMinutesBeforeStart_isClosed() {
        assertThat(DoorWindow.isOpen(START, END, kst("2026-08-31T23:49:00"))).isFalse();
    }

    @Test
    @DisplayName("사용 기간 한가운데 → 열린다")
    void midPeriod_isOpen() {
        assertThat(DoorWindow.isOpen(START, END, kst("2026-09-07T14:00:00"))).isTrue();
    }

    @Test
    @DisplayName("종료일 23:59:59 → 아직 열린다")
    void lastMomentOfEndDate_isOpen() {
        assertThat(DoorWindow.isOpen(START, END, kst("2026-09-14T23:59:59"))).isTrue();
    }

    @Test
    @DisplayName("종료 다음 날 00:00 → 닫힌다")
    void afterEndDate_isClosed() {
        assertThat(DoorWindow.isOpen(START, END, kst("2026-09-15T00:00:00"))).isFalse();
    }

    @Test
    @DisplayName("한참 이전 → 닫힌다")
    void longBeforeStart_isClosed() {
        assertThat(DoorWindow.isOpen(START, END, kst("2026-08-01T09:00:00"))).isFalse();
    }

    @Test
    @DisplayName("🚨 판정은 KST 기준이다 — 시간대를 고정하지 않으면 창이 9시간 움직인다")
    void windowIsAnchoredToSeoulTime() {
        // 같은 순간을 UTC 벽시계로 읽으면 8/31 14:50이라 "아직 한참 전"으로 보인다.
        // 시간대를 고정하지 않으면 서버가 어디서 도느냐에 따라 개방 시각이 달라진다.
        Instant justOpened = kst("2026-08-31T23:50:00");

        assertThat(justOpened).isEqualTo(Instant.parse("2026-08-31T14:50:00Z"));
        assertThat(DoorWindow.isOpen(START, END, justOpened)).isTrue();
    }
}
