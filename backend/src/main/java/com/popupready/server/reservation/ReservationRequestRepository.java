package com.popupready.server.reservation;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReservationRequestRepository extends JpaRepository<ReservationRequest, Long> {

    /** 내 예약 목록. 최근 것이 먼저 온다 — 현장에서 찾는 것은 대개 방금 만든 예약이다. */
    List<ReservationRequest> findByBrandUserIdOrderByIdDesc(long brandUserId);

    List<ReservationRequest> findByBrandUserIdAndStatusOrderByIdDesc(long brandUserId, ReservationStatus status);

    /**
     * 질의 기간 안에서 집기별로 <b>가장 많이 잡힌 날</b>의 수량(T1-2, §2.2-A).
     *
     * <p>왜 최댓값인가 — 기간 합계로 세면 날짜가 어긋난 예약들까지 더해져 멀쩡한 집기가 품절로
     * 보이고, 평균으로 세면 가장 붐비는 날에 품절이 뚫린다. 배치가 가능한지는 <b>가장 빡빡한 날</b>이
     * 정한다.
     *
     * <p><b>공간으로 거르지 않는다.</b> 집기는 공간에 매이지 않으므로 다른 공간의 예약이 잡아간
     * 수량도 그대로 차감돼야 한다 — 공간별로 세면 서로 다른 공간의 두 예약이 같은 집기의 마지막
     * 1개를 나눠 갖는다.
     *
     * <p><b>{@code PAID}만 센다.</b> 결제 전 예약이 자리를 잡으면 결제하지 않은 요청이 남의 예약을
     * 막는다.
     *
     * <p>레이아웃을 정규화 테이블로 비정규화하지 않고 JSONB를 그대로 펼친다 — 이번 스프린트에
     * 이미 엔티티가 셋 들어오는 구간이라 스키마를 하나라도 덜 움직이는 편이 낫고, 개발 데이터
     * 규모(상가 10건 내외)에서 성능 차이가 없다. 규모가 문제가 되면 그때 사용량 테이블로 옮긴다.
     */
    @Query(
            value =
                    """
                    WITH day AS (
                        SELECT generate_series(CAST(:startDate AS date), CAST(:endDate AS date), INTERVAL '1 day') AS on_date
                    ),
                    placement AS (
                        SELECT rr.id AS reservation_id,
                               rr.start_date,
                               rr.end_date,
                               CAST(item ->> 'fixtureId' AS bigint) AS fixture_id,
                               COUNT(*) AS qty
                        FROM reservation_request rr
                        CROSS JOIN LATERAL jsonb_array_elements(rr.layout -> 'items') AS item
                        WHERE rr.status = 'PAID'
                          AND rr.start_date <= CAST(:endDate AS date)
                          AND rr.end_date >= CAST(:startDate AS date)
                        GROUP BY rr.id, rr.start_date, rr.end_date, CAST(item ->> 'fixtureId' AS bigint)
                    ),
                    daily AS (
                        SELECT day.on_date, p.fixture_id, SUM(p.qty) AS day_qty
                        FROM day
                        JOIN placement p ON p.start_date <= day.on_date AND p.end_date >= day.on_date
                        GROUP BY day.on_date, p.fixture_id
                    )
                    SELECT fixture_id AS fixtureId, CAST(MAX(day_qty) AS int) AS reservedQty
                    FROM daily
                    GROUP BY fixture_id
                    """,
            nativeQuery = true)
    List<FixtureUsage> reservedQuantities(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);
}
