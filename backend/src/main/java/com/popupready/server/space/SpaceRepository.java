package com.popupready.server.space;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SpaceRepository extends JpaRepository<Space, Long> {

    /** 시드가 이미 들어갔는지 항목별로 판단할 때 쓴다. */
    boolean existsByName(String name);

    /**
     * 중심 좌표 반경 안의 ACTIVE 공간을 찾는다(US-101).
     *
     * <p><b>거리 단위 주의</b>: {@code geometry(Point,4326)}에 {@code ST_DWithin}을 그대로 쓰면
     * 거리가 미터가 아니라 <b>도(degree)</b>로 해석된다. 반경을 미터로 받는 API 계약을 지키려면
     * 양쪽을 {@code geography}로 캐스팅해야 한다 — 그래야 구면 거리(m)로 비교한다.
     *
     * <p>필터는 셋 다 선택이다. null이면 그 조건을 적용하지 않는다.
     *
     * <p>native query인 이유는 PostGIS 함수와 geography 캐스팅을 명시적으로 드러내기 위해서다.
     * 이 프로젝트는 타 DB 호환을 고려하지 않는다.
     */
    default List<Space> searchWithin(
            double lat, double lng, int radiusMeters, Double minArea, Long maxRent, Integer minPower) {
        // enum 이름을 SQL 문자열로 박아두면, 상수를 바꿔도 컴파일은 통과하고 쿼리만 조용히
        // 아무것도 반환하지 않게 된다. 여기서 넘겨 컴파일러가 연결을 지키게 한다.
        return searchActiveWithin(lat, lng, radiusMeters, minArea, maxRent, minPower, SpaceStatus.ACTIVE.name());
    }

    @Query(
            value =
                    """
                    SELECT * FROM space s
                     WHERE s.status = :activeStatus
                       AND ST_DWithin(
                               s.location::geography,
                               ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                               :radiusMeters)
                       AND (CAST(:minArea AS double precision) IS NULL OR s.floor_area_m2 >= :minArea)
                       AND (CAST(:maxRent AS bigint) IS NULL OR s.daily_rent <= :maxRent)
                       AND (CAST(:minPower AS integer) IS NULL OR s.max_power_watt >= :minPower)
                     ORDER BY s.id
                    """,
            nativeQuery = true)
    List<Space> searchActiveWithin(
            @Param("lat") double lat,
            @Param("lng") double lng,
            @Param("radiusMeters") int radiusMeters,
            @Param("minArea") Double minArea,
            @Param("maxRent") Long maxRent,
            @Param("minPower") Integer minPower,
            @Param("activeStatus") String activeStatus);
}
