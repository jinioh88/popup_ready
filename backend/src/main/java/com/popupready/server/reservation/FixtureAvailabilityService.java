package com.popupready.server.reservation;

import com.popupready.server.fixture.FixtureResponse;
import com.popupready.server.fixture.FixtureService;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 날짜별 집기 가용 수량(T1-2, §2.2-A).
 *
 * <p>{@link ReservationRequestService}에 넣지 않은 것은 의도다 — 예약 생성 유스케이스와 조회 축이
 * 다르고, 합치면 그 서비스가 집기 카탈로그까지 들고 있게 된다.
 *
 * <p>계산은 뺄셈 한 줄이고 어려운 부분은 집계 쿼리가 맡는다. 여기서 지키는 것은 두 가지다 —
 * <b>모든 집기를 돌려주는 것</b>(빌더 팔레트가 품절을 표시하려면 0인 것도 알아야 한다)과
 * <b>음수를 만들지 않는 것</b>이다.
 */
@Service
@Transactional(readOnly = true)
public class FixtureAvailabilityService {

    private final FixtureService fixtureService;

    private final ReservationRequestRepository reservationRequestRepository;

    public FixtureAvailabilityService(
            FixtureService fixtureService, ReservationRequestRepository reservationRequestRepository) {
        this.fixtureService = fixtureService;
        this.reservationRequestRepository = reservationRequestRepository;
    }

    public List<FixtureAvailabilityResponse> availability(ReservationPeriod period) {
        Map<Long, Integer> reserved =
                reservationRequestRepository.reservedQuantities(period.startDate(), period.endDate()).stream()
                        .collect(Collectors.toMap(FixtureUsage::getFixtureId, FixtureUsage::getReservedQty));

        return fixtureService.list(null).stream()
                .map(fixture -> toAvailability(fixture, reserved.getOrDefault(fixture.id(), 0)))
                .toList();
    }

    /**
     * 재고보다 많이 잡혀 있으면 가용량은 0이다(음수가 아니다).
     *
     * <p>재고를 줄였는데 이미 잡힌 예약이 그보다 많은 경우에 실제로 일어난다. 음수를 그대로
     * 내보내면 웹의 "남은 수량" 표시가 -2가 되고, 클라이언트마다 다르게 해석한다.
     */
    private static FixtureAvailabilityResponse toAvailability(FixtureResponse fixture, int reservedQty) {
        return new FixtureAvailabilityResponse(
                fixture.id(), fixture.stockQty(), reservedQty, Math.max(0, fixture.stockQty() - reservedQty));
    }
}
