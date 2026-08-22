package com.popupready.server.space;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SpaceServiceTest {

    private static final GeometryFactory GEOMETRY_FACTORY = new GeometryFactory(new PrecisionModel(), 4326);

    @Mock
    private SpaceRepository spaceRepository;

    @InjectMocks
    private SpaceService spaceService;

    private Space sampleSpace() {
        return Space.create(
                "성수 연무장길 팝업 1층",
                "서울 성동구 연무장길 45",
                GEOMETRY_FACTORY.createPoint(new Coordinate(127.0557, 37.5445)),
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
    @DisplayName("반경 검색 → 엔티티를 마커용 요약으로 옮긴다")
    void search_mapsToSummary() {
        given(spaceRepository.searchWithin(37.5445, 127.0557, 1_000, null, null, null))
                .willReturn(List.of(sampleSpace()));

        List<SpaceSummaryResponse> found = spaceService.search(37.5445, 127.0557, 1_000, null, null, null);

        assertThat(found).singleElement().satisfies(summary -> {
            assertThat(summary.name()).isEqualTo("성수 연무장길 팝업 1층");
            assertThat(summary.address()).isEqualTo("서울 성동구 연무장길 45");
            assertThat(summary.dailyRent()).isEqualTo(450_000L);
        });
    }

    @Test
    @DisplayName("반경 검색 → 좌표를 lat/lng 쌍으로 평평하게 옮긴다")
    void search_flattensLocationToLatLng() {
        given(spaceRepository.searchWithin(37.5445, 127.0557, 1_000, null, null, null))
                .willReturn(List.of(sampleSpace()));

        LocationDto location = spaceService
                .search(37.5445, 127.0557, 1_000, null, null, null)
                .getFirst()
                .location();

        assertThat(location.lat()).isEqualTo(37.5445);
        assertThat(location.lng()).isEqualTo(127.0557);
    }

    @Test
    @DisplayName("상세 조회 → 빌더 진입용 grid 정보까지 담는다")
    void detail_includesGridInformation() {
        given(spaceRepository.findById(1L)).willReturn(Optional.of(sampleSpace()));

        SpaceDetailResponse detail = spaceService.detail(1L);

        assertThat(detail.gridCols()).isEqualTo(20);
        assertThat(detail.gridRows()).isEqualTo(12);
        assertThat(detail.cellSizeMm()).isEqualTo(500);
        assertThat(detail.depositRate()).isEqualByComparingTo("0.10");
    }

    @Test
    @DisplayName("없는 공간 상세 조회 → SPACE_NOT_FOUND로 거부한다")
    void detail_unknownId_isRejected() {
        given(spaceRepository.findById(999L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> spaceService.detail(999L))
                .isInstanceOf(ApiException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.SPACE_NOT_FOUND);
    }
}
