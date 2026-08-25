package com.popupready.server.reservation;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import com.popupready.server.fixture.FixtureResponse;
import com.popupready.server.fixture.FixtureService;
import com.popupready.server.space.SpaceDetailResponse;
import com.popupready.server.space.SpaceService;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 결제 승인 직전의 예약 재검증(§2.2-C 2-2 ~ 2-4).
 *
 * <p><b>왜 다시 보는가</b> — 예약 생성과 결제 사이에는 시간이 흐른다. 그 사이 다른 브랜드가 같은
 * 기간을 결제했을 수도, 집기 재고가 줄었을 수도 있다. 생성 시점의 통과는 결제 시점의 통과가
 * 아니다.
 *
 * <p>{@code PaymentService}에서 떼어낸 이유는 책임이 다르기 때문이다 — 결제 서비스가 아는 것은
 * <b>순서</b>(락 → 재확인 → 금액 대조 → PG → 저장)이고, <b>무엇이 유효한 예약인가</b>는 예약
 * 도메인의 지식이다. 합치면 결제 서비스가 집기 카탈로그와 공간 규격까지 들고 있게 된다.
 *
 * <p>이 클래스는 <b>락 안에서 호출되는 것을 전제</b>한다. 혼자서는 경합을 막지 못한다 —
 * 확인과 저장 사이에 남이 끼어들 수 있기 때문이며, 그 직렬화는 호출자가 책임진다.
 */
@Service
@Transactional(readOnly = true)
public class BookingRevalidator {

    private final SpaceService spaceService;

    private final FixtureService fixtureService;

    private final FixtureAvailabilityService fixtureAvailabilityService;

    private final SpaceOverlapChecker spaceOverlapChecker;

    public BookingRevalidator(
            SpaceService spaceService,
            FixtureService fixtureService,
            FixtureAvailabilityService fixtureAvailabilityService,
            SpaceOverlapChecker spaceOverlapChecker) {
        this.spaceService = spaceService;
        this.fixtureService = fixtureService;
        this.fixtureAvailabilityService = fixtureAvailabilityService;
        this.spaceOverlapChecker = spaceOverlapChecker;
    }

    /** 순서는 §2.2-C 그대로다. 먼저 거절되는 것이 사용자가 먼저 고쳐야 할 것이다. */
    public void revalidate(ReservationRequestResponse reservation) {
        requireNoOverlap(reservation);
        requireFixturesAvailable(reservation);
        requireLayoutStillValid(reservation);
    }

    /**
     * 2-2 — 같은 공간·겹치는 기간에 이미 결제된 예약이 있으면 자리를 내줄 수 없다.
     *
     * <p><b>이것이 최종 판정이다.</b> 예약 생성 시점에도 같은 검사({@link SpaceOverlapChecker})가
     * 돌지만 그쪽은 락 밖의 조기 안내이며, 생성과 결제 사이에 남이 결제를 끝낼 수 있다. 앞에서
     * 막으니 여기는 필요 없다는 논리로 이 호출을 걷어내면 이중 예약이 실제로 난다.
     */
    private void requireNoOverlap(ReservationRequestResponse reservation) {
        spaceOverlapChecker.requireNoOverlap(
                reservation.spaceId(), reservation.startDate(), reservation.endDate(), reservation.id());
    }

    /**
     * 2-3 — 날짜별 집기 가용 수량. 총 재고 초과({@code FIXTURE_STOCK_EXCEEDED})와 코드가 다르다:
     * 이쪽은 "지금은 없다"라 기간을 옮기면 해소되고, 저쪽은 "애초에 그만큼 없다"이다.
     *
     * <p><b>내 예약이 잡은 수량은 빼고 센다.</b> 가용량 집계는 {@code PAID}만 세므로 아직
     * {@code PAYMENT_PENDING}인 이 예약은 포함되지 않는다 — 자기 자신 때문에 거절되지 않는다.
     */
    private void requireFixturesAvailable(ReservationRequestResponse reservation) {
        Map<Long, Integer> wanted = reservation.layout().items().stream()
                .collect(Collectors.groupingBy(LayoutItemDto::fixtureId, Collectors.summingInt(item -> 1)));
        if (wanted.isEmpty()) {
            return;
        }
        Map<Long, Integer> available =
                fixtureAvailabilityService
                        .availability(ReservationPeriod.of(reservation.startDate(), reservation.endDate()))
                        .stream()
                        .collect(Collectors.toMap(
                                FixtureAvailabilityResponse::fixtureId, FixtureAvailabilityResponse::availableQty));

        wanted.forEach((fixtureId, count) -> {
            int remaining = available.getOrDefault(fixtureId, 0);
            if (count > remaining) {
                throw new ApiException(
                        ErrorCode.FIXTURE_UNAVAILABLE,
                        "해당 기간에 집기가 부족합니다 (fixtureId: %d, 필요 %d개, 가용 %d개)".formatted(fixtureId, count, remaining));
            }
        });
    }

    /**
     * 2-4 — 도면과 전력 한도를 생성 때와 같은 규칙으로 다시 본다. 공간 규격이나 집기 사양이
     * 바뀌었을 수 있고, 그 변경은 저장된 레이아웃을 조용히 무효로 만든다.
     *
     * <p>면적은 판정하지 않는다(§2.2-F).
     */
    private void requireLayoutStillValid(ReservationRequestResponse reservation) {
        SpaceDetailResponse space = spaceService.detail(reservation.spaceId());
        LayoutDto layout = reservation.layout();
        Set<Long> fixtureIds = layout.items().stream()
                .map(LayoutItemDto::fixtureId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Long, FixtureSpec> catalog = fixtureIds.isEmpty()
                ? Map.of()
                : fixtureService.findAllByIds(fixtureIds).stream()
                        .collect(Collectors.toMap(FixtureResponse::id, BookingRevalidator::toSpec));

        LayoutValidator.validate(
                layout,
                new GridSpec(space.gridCols(), space.gridRows(), space.cellSizeMm()),
                space.maxPowerWatt(),
                catalog);
    }

    private static FixtureSpec toSpec(FixtureResponse fixture) {
        return new FixtureSpec(
                fixture.id(),
                fixture.widthMm(),
                fixture.depthMm(),
                fixture.powerWatt(),
                fixture.dailyRentalFee(),
                fixture.stockQty());
    }

    /** 배치된 집기 ID 목록. 락 키를 만드는 쪽이 쓴다 — 집기는 공간을 가로지르므로 함께 잠가야 한다. */
    public static List<Long> placedFixtureIds(ReservationRequestResponse reservation) {
        return reservation.layout().items().stream()
                .map(LayoutItemDto::fixtureId)
                .distinct()
                .sorted()
                .toList();
    }
}
