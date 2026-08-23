package com.popupready.server.reservation;

import com.popupready.server.auth.AuthDevSeeder;
import com.popupready.server.auth.UserService;
import com.popupready.server.fixture.FixtureResponse;
import com.popupready.server.fixture.FixtureService;
import com.popupready.server.space.SpaceDetailResponse;
import com.popupready.server.space.SpaceService;
import com.popupready.server.space.SpaceSummaryResponse;
import java.time.LocalDate;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 도어 개방 검증용 예약 시드(US-301).
 *
 * <p><b>왜 필요한가</b> — 도어 API의 403은 갈래가 셋(당사자 아님 · 미결제 · 시간창 밖)인데,
 * 결제 경로가 아직 없어(US-201은 다음 순서다) {@code PAID} 예약을 만들 방법이 없다. 시드가 없으면
 * 도어를 실구현해도 <b>모바일은 여전히 세 갈래 중 하나도 밟지 못한다</b> — 구현은 있는데 그 경로를
 * 아무도 지나가지 않은 상태가 된다.
 *
 * <pre>
 * ① 오늘 시작 · PAID            → 정상 개방
 * ② 다음 달 시작 · PAID          → 403 시간창 밖
 * ③ 오늘 시작 · CONTRACT_SIGNED  → 403 미결제
 * </pre>
 *
 * <p>④ "당사자 아님"은 시드가 아니라 <b>계정 전환</b>으로 밟는다(건물주 계정으로 ①을 호출).
 *
 * <p><b>멱등 기준은 테이블이 아니라 시드 키다.</b> "예약 테이블이 비었으면"으로 판단하면 이미
 * 예약이 한 건이라도 있는 기존 로컬 DB에는 시드가 영영 들어가지 않고, <b>그 실패가 조용하다</b> —
 * 시더 코드에는 있는데 서버에는 없다. 그래서 "이 브랜드의 PAID 예약이 있는가"로 판단하고,
 * 건너뛸 때는 무엇을 해야 하는지까지 로그에 남긴다.
 */
@Component
@ConditionalOnProperty(name = "popupready.seed.dev-data", havingValue = "true")
@Order(3)
public class ReservationDevSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(ReservationDevSeeder.class);

    /** 사용 기간 30일 하드 캡 안에 들어야 한다(T5-0). 여유를 두고 3주로 잡는다. */
    private static final int USE_DAYS = 20;

    /** 시간창 밖 시드는 넉넉히 미래여야 한다 — 며칠 뒤 시연에서도 여전히 "아직 열리지 않음"이어야 한다. */
    private static final int FUTURE_OFFSET_DAYS = 30;

    private final ReservationRequestRepository reservationRequestRepository;
    private final SpaceService spaceService;
    private final FixtureService fixtureService;
    private final UserService userService;

    public ReservationDevSeeder(
            ReservationRequestRepository reservationRequestRepository,
            SpaceService spaceService,
            FixtureService fixtureService,
            UserService userService) {
        this.reservationRequestRepository = reservationRequestRepository;
        this.spaceService = spaceService;
        this.fixtureService = fixtureService;
        this.userService = userService;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        Long brandUserId = userService.findIdByEmail(AuthDevSeeder.BRAND_EMAIL).orElse(null);
        if (brandUserId == null) {
            log.warn("브랜드 계정이 없어 도어 검증용 예약 시드를 건너뛴다");
            return;
        }
        if (hasPaidReservation(brandUserId)) {
            // 조용히 넘어가지 않는다. 이 줄이 없으면 "시더에는 있는데 서버에는 없다"가 원인 모를
            // 검증 실패로 나타난다.
            log.info("도어 검증용 예약 시드를 건너뛴다 — 이 브랜드에 PAID 예약이 이미 있다. "
                    + "다시 넣으려면 해당 예약을 지우거나 infra에서 docker compose down -v 후 재기동한다.");
            return;
        }

        SpaceDetailResponse space = firstActiveSpace();
        if (space == null) {
            log.warn("ACTIVE 공간이 없어 도어 검증용 예약 시드를 건너뛴다");
            return;
        }
        FixtureResponse fixture = fixtureService.list(null).stream().findFirst().orElse(null);
        if (fixture == null) {
            log.warn("집기가 없어 도어 검증용 예약 시드를 건너뛴다");
            return;
        }

        LocalDate today = LocalDate.now();
        reservationRequestRepository.saveAll(List.of(
                paid(space, fixture, brandUserId, today, today.plusDays(USE_DAYS)),
                paid(
                        space,
                        fixture,
                        brandUserId,
                        today.plusDays(FUTURE_OFFSET_DAYS),
                        today.plusDays(FUTURE_OFFSET_DAYS + USE_DAYS)),
                contractSigned(space, fixture, brandUserId, today, today.plusDays(USE_DAYS))));

        log.info(
                "도어 검증용 예약 시드 3건 삽입 — 정상 개방({} ~), 시간창 밖({} ~), 미결제({} ~)",
                today,
                today.plusDays(FUTURE_OFFSET_DAYS),
                today);
    }

    private boolean hasPaidReservation(Long brandUserId) {
        return !reservationRequestRepository
                .findByBrandUserIdAndStatusOrderByIdDesc(brandUserId, ReservationStatus.PAID)
                .isEmpty();
    }

    private SpaceDetailResponse firstActiveSpace() {
        // 검색은 ACTIVE만 돌려준다. 좌표·반경은 시드 상가를 모두 덮는 값이면 된다.
        List<SpaceSummaryResponse> found = spaceService.search(37.5445, 127.0557, 50_000, null, null, null);
        return found.isEmpty() ? null : spaceService.detail(found.getFirst().id());
    }

    private ReservationRequest paid(
            SpaceDetailResponse space, FixtureResponse fixture, Long brandUserId, LocalDate start, LocalDate end) {
        ReservationRequest request = build(space, fixture, brandUserId, start, end);
        // 전이 메서드로만 상태를 옮긴다 — 필드를 직접 세팅하면 엔티티가 막는 잘못된 전이를
        // 시더가 우회하게 되고, 그 우회가 실제 버그를 가린다.
        request.markContractPending();
        request.markContractSigned();
        request.markPaymentPending();
        request.markPaid();
        return request;
    }

    private ReservationRequest contractSigned(
            SpaceDetailResponse space, FixtureResponse fixture, Long brandUserId, LocalDate start, LocalDate end) {
        ReservationRequest request = build(space, fixture, brandUserId, start, end);
        request.markContractPending();
        request.markContractSigned();
        return request;
    }

    private ReservationRequest build(
            SpaceDetailResponse space, FixtureResponse fixture, Long brandUserId, LocalDate start, LocalDate end) {
        ReservationPeriod period = ReservationPeriod.of(start, end);
        LayoutDto layout = new LayoutDto(
                space.gridCols(),
                space.gridRows(),
                space.cellSizeMm(),
                List.of(new LayoutItemDto(fixture.id(), 0, 0, 0)));
        FixtureSpec spec = new FixtureSpec(
                fixture.id(),
                fixture.widthMm(),
                fixture.depthMm(),
                fixture.powerWatt(),
                fixture.dailyRentalFee(),
                fixture.stockQty());
        EstimateResponse estimate =
                EstimateCalculator.calculate(period, space.dailyRent(), space.depositRate(), List.of(spec));
        return ReservationRequest.create(space.id(), brandUserId, start, end, layout, estimate);
    }
}
