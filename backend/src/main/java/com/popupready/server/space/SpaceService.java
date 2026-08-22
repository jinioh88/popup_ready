package com.popupready.server.space;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import java.util.List;
import org.locationtech.jts.geom.Point;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 공간 탐색 유스케이스(US-101).
 *
 * <p>컨트롤러가 리포지토리를 직접 부르지 않게 한 층을 둔다 — 이후 붙을 조합 로직이 컨트롤러에
 * 쌓이는 것을 막고, 다른 도메인이 공간 정보를 볼 때 통과할 창구이기도 하다(패키지 경계 규칙).
 */
@Service
@Transactional(readOnly = true)
public class SpaceService {

    private final SpaceRepository spaceRepository;

    public SpaceService(SpaceRepository spaceRepository) {
        this.spaceRepository = spaceRepository;
    }

    public List<SpaceSummaryResponse> search(
            double lat, double lng, int radiusMeters, Double minArea, Long maxRent, Integer minPower) {
        return spaceRepository.searchWithin(lat, lng, radiusMeters, minArea, maxRent, minPower).stream()
                .map(SpaceService::toSummary)
                .toList();
    }

    public SpaceDetailResponse detail(Long id) {
        Space space = spaceRepository
                .findById(id)
                .orElseThrow(() -> new ApiException(ErrorCode.SPACE_NOT_FOUND, "공간을 찾을 수 없습니다"));
        return toDetail(space);
    }

    private static SpaceSummaryResponse toSummary(Space space) {
        return new SpaceSummaryResponse(
                space.getId(),
                space.getName(),
                space.getAddress(),
                toLocation(space.getLocation()),
                space.getDailyRent(),
                space.getFloorAreaM2(),
                space.getMaxPowerWatt());
    }

    private static SpaceDetailResponse toDetail(Space space) {
        return new SpaceDetailResponse(
                space.getId(),
                space.getName(),
                space.getAddress(),
                toLocation(space.getLocation()),
                space.getDailyRent(),
                space.getDepositRate(),
                space.getFloorAreaM2(),
                space.getMaxPowerWatt(),
                space.getGridCols(),
                space.getGridRows(),
                space.getCellSizeMm(),
                space.getStatus());
    }

    /** PostGIS 좌표는 (경도, 위도) 순이다 — x가 경도, y가 위도다. 뒤집으면 지도에서 엉뚱한 곳을 가리킨다. */
    private static LocationDto toLocation(Point point) {
        return new LocationDto(point.getY(), point.getX());
    }
}
