package com.popupready.server.space;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;

/**
 * 반경 검색(US-101). 로컬 docker PostGIS 대상이다.
 *
 * <p><b>단위 함정</b>: {@code geometry(Point,4326)}에서 {@code ST_DWithin}의 거리 단위는 미터가
 * 아니라 <b>도(degree)</b>다. 미터로 재려면 geography로 캐스팅해야 한다. 아래 경계 테스트가
 * 그 실수를 잡는다 — degree로 계산하면 반경 1000이 지구 전체를 덮어 먼 지점도 걸린다.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class SpaceSearchRepositoryTest {

    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    /** 성수 연무장길 기준점. */
    private static final double CENTER_LAT = 37.5445;

    private static final double CENTER_LNG = 127.0557;

    /** 위도 1도는 약 111km다. 0.0045도 ≈ 500m, 0.018도 ≈ 2km. */
    private static final double HALF_KM_IN_DEGREES = 0.0045;

    private static final double TWO_KM_IN_DEGREES = 0.018;

    @Autowired
    private SpaceRepository spaceRepository;

    private Space spaceAt(String name, double lat, double lng, double areaM2, long dailyRent, int maxPowerWatt) {
        Point location = GEOMETRY_FACTORY.createPoint(new Coordinate(lng, lat));
        return Space.create(
                name, "서울 성동구", location, dailyRent, new BigDecimal("0.10"), areaM2, maxPowerWatt, 20, 12, 500, 1L);
    }

    private Space nearby(String name) {
        return spaceAt(name, CENTER_LAT + HALF_KM_IN_DEGREES, CENTER_LNG, 80.0, 450_000L, 5_000);
    }

    private Space faraway(String name) {
        return spaceAt(name, CENTER_LAT + TWO_KM_IN_DEGREES, CENTER_LNG, 80.0, 450_000L, 5_000);
    }

    private List<Space> search(int radiusMeters, Double minArea, Long maxRent, Integer minPower) {
        return spaceRepository.searchWithin(CENTER_LAT, CENTER_LNG, radiusMeters, minArea, maxRent, minPower);
    }

    @Test
    @DisplayName("반경 1km 검색 → 500m 지점의 공간이 포함된다")
    void searchWithin_includesSpaceInsideRadius() {
        spaceRepository.save(nearby("가까운 공간"));

        assertThat(search(1_000, null, null, null)).extracting(Space::getName).contains("가까운 공간");
    }

    @Test
    @DisplayName("반경 1km 검색 → 2km 지점의 공간은 제외된다")
    void searchWithin_excludesSpaceOutsideRadius() {
        spaceRepository.save(faraway("먼 공간"));

        assertThat(search(1_000, null, null, null)).extracting(Space::getName).doesNotContain("먼 공간");
    }

    @Test
    @DisplayName("반경을 3km로 넓히면 → 2km 지점의 공간도 포함된다")
    void searchWithin_widerRadiusIncludesFarSpace() {
        spaceRepository.save(faraway("먼 공간"));

        assertThat(search(3_000, null, null, null)).extracting(Space::getName).contains("먼 공간");
    }

    @Test
    @DisplayName("최소 면적 필터 → 기준에 못 미치는 공간은 제외된다")
    void searchWithin_filtersByMinArea() {
        spaceRepository.save(spaceAt("좁은 공간", CENTER_LAT, CENTER_LNG, 30.0, 450_000L, 5_000));

        assertThat(search(1_000, 50.0, null, null)).extracting(Space::getName).doesNotContain("좁은 공간");
    }

    @Test
    @DisplayName("대여료 상한 필터 → 상한을 넘는 공간은 제외된다")
    void searchWithin_filtersByMaxRent() {
        spaceRepository.save(spaceAt("비싼 공간", CENTER_LAT, CENTER_LNG, 80.0, 900_000L, 5_000));

        assertThat(search(1_000, null, 600_000L, null))
                .extracting(Space::getName)
                .doesNotContain("비싼 공간");
    }

    @Test
    @DisplayName("최소 허용 전력 필터 → 기준에 못 미치는 공간은 제외된다")
    void searchWithin_filtersByMinPower() {
        spaceRepository.save(spaceAt("전력 부족 공간", CENTER_LAT, CENTER_LNG, 80.0, 450_000L, 2_000));

        assertThat(search(1_000, null, null, 3_000)).extracting(Space::getName).doesNotContain("전력 부족 공간");
    }

    @Test
    @DisplayName("필터를 모두 비우면 → 반경 안의 공간이 그대로 나온다")
    void searchWithin_withoutFilters_returnsAllInRadius() {
        spaceRepository.save(nearby("가까운 공간"));

        assertThat(search(1_000, null, null, null)).isNotEmpty();
    }

    @Test
    @DisplayName("INACTIVE 공간 → 검색 결과에서 제외된다")
    void searchWithin_excludesInactiveSpace() {
        Space inactive = nearby("비활성 공간");
        inactive.deactivate();
        spaceRepository.save(inactive);

        assertThat(search(1_000, null, null, null)).extracting(Space::getName).doesNotContain("비활성 공간");
    }
}
