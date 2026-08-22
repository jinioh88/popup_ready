package com.popupready.server.space;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;

/** PostGIS geometry(Point,4326) 매핑을 로컬 docker PostGIS 대상으로 확인한다. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class SpaceRepositoryTest {

    /** SRID 4326 = WGS84 위경도. 좌표 순서는 (경도, 위도)다 — 뒤집으면 지도에서 엉뚱한 곳을 가리킨다. */
    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    @Autowired
    private SpaceRepository spaceRepository;

    private Space sampleSpace() {
        Point location = GEOMETRY_FACTORY.createPoint(new Coordinate(127.0557, 37.5445));
        return Space.create(
                "성수 연무장길 팝업 1층",
                "서울 성동구 연무장길 45",
                location,
                450_000L,
                new BigDecimal("0.10"),
                82.5,
                5_000,
                20,
                12,
                500,
                1L);
    }

    @Test
    @DisplayName("공간 저장 → 식별자가 부여되고 조회로 왕복된다")
    void save_assignsIdAndRoundTrips() {
        Space saved = spaceRepository.save(sampleSpace());

        assertThat(saved.getId()).isNotNull();
        assertThat(spaceRepository.findById(saved.getId())).get().satisfies(found -> {
            assertThat(found.getName()).isEqualTo("성수 연무장길 팝업 1층");
            assertThat(found.getDailyRent()).isEqualTo(450_000L);
        });
    }

    @Test
    @DisplayName("위치 좌표 저장 → SRID 4326과 경도·위도가 그대로 왕복된다")
    void save_preservesSridAndCoordinates() {
        Space saved = spaceRepository.save(sampleSpace());

        Point location = spaceRepository.findById(saved.getId()).orElseThrow().getLocation();
        assertThat(location.getSRID()).isEqualTo(4326);
        assertThat(location.getX()).isEqualTo(127.0557);
        assertThat(location.getY()).isEqualTo(37.5445);
    }

    @Test
    @DisplayName("새 공간 → 상태는 ACTIVE로 시작한다")
    void create_startsActive() {
        assertThat(spaceRepository.save(sampleSpace()).getStatus()).isEqualTo(SpaceStatus.ACTIVE);
    }
}
