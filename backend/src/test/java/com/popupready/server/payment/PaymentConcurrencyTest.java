package com.popupready.server.payment;

import static org.assertj.core.api.Assertions.assertThat;

import com.popupready.server.auth.AuthDevSeeder;
import com.popupready.server.auth.UserService;
import com.popupready.server.fixture.FixtureResponse;
import com.popupready.server.fixture.FixtureService;
import com.popupready.server.reservation.EstimateCalculator;
import com.popupready.server.reservation.EstimateResponse;
import com.popupready.server.reservation.FixtureSpec;
import com.popupready.server.reservation.LayoutDto;
import com.popupready.server.reservation.LayoutItemDto;
import com.popupready.server.reservation.ReservationPeriod;
import com.popupready.server.reservation.ReservationRequest;
import com.popupready.server.reservation.ReservationRequestRepository;
import com.popupready.server.reservation.ReservationStatus;
import com.popupready.server.space.SpaceDetailResponse;
import com.popupready.server.space.SpaceService;
import com.popupready.server.space.SpaceSummaryResponse;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * 🚨 <b>US-201의 인수 조건.</b> 이 스토리는 동시성 테스트 없이 완료로 보지 않는다 —
 * 순차 테스트는 증명하지 못한다.
 *
 * <p>이번 스프린트에 이미 겪었다. T1-1의 refresh 회전은 <b>순차 테스트 7건이 전부 초록인 채</b>
 * read-modify-write 경합 버그를 안고 있었고, 실서버에 동시 요청 2건을 넣고서야 드러났다.
 * 여기서는 그 순서를 뒤집어 경합을 먼저 만든다.
 *
 * <p>로컬 Redis·PostGIS 대상이다. 락은 Redis에, 최종 판정은 DB 상태에 있으므로 둘 다 실물이어야
 * 한다 — <b>성공 여부를 응답이 아니라 DB의 PAID 행 개수로 판정</b>하는 것도 같은 이유다.
 */
@SpringBootTest
class PaymentConcurrencyTest {

    private static final int THREADS = 6;

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private ReservationRequestRepository reservationRequestRepository;

    @Autowired
    private SpaceService spaceService;

    @Autowired
    private FixtureService fixtureService;

    @Autowired
    private UserService userService;

    private long brandUserId;

    private SpaceDetailResponse space;

    private FixtureResponse fixture;

    /** 이 테스트가 쓰는 먼 미래 구간. 시드·다른 테스트의 예약과 겹치지 않는 해를 고른다. */
    private static final int TEST_YEAR = 2027;

    @BeforeEach
    void loadSeeds() {
        // 앞선 실행이 남긴 PAID 예약이 있으면 "이미 예약된 기간"으로 전부 거절돼, 락이 멀쩡해도
        // 테스트가 빨간불이 된다. 실제로 그렇게 한 번 헤맸다 — 격리는 테스트가 스스로 책임진다.
        reservationRequestRepository.deleteAll(reservationRequestRepository.findAll().stream()
                .filter(r -> r.getStartDate().getYear() == TEST_YEAR)
                .toList());
        brandUserId = userService.findIdByEmail(AuthDevSeeder.BRAND_EMAIL).orElseThrow();
        List<SpaceSummaryResponse> spaces = spaceService.search(37.5445, 127.0557, 50_000, null, null, null);
        space = spaceService.detail(spaces.getFirst().id());
        fixture = fixtureService.list(null).getFirst();
    }

    /** 계약 서명까지 끝난 예약. 결제 직전 상태를 만든다. */
    private Long signedReservation(LocalDate start, LocalDate end, long spaceId) {
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
        ReservationRequest request = ReservationRequest.create(spaceId, brandUserId, start, end, layout, estimate);
        request.markContractPending();
        request.markContractSigned();
        return reservationRequestRepository.save(request).getId();
    }

    /** 같은 출발선에서 동시에 실행하고 예외는 삼켜 반환한다 — 여기서 볼 것은 최종 DB 상태다. */
    private void raceAll(List<Callable<Void>> tasks) throws Exception {
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(tasks.size());
        try {
            List<Future<Void>> futures = new ArrayList<>();
            for (Callable<Void> task : tasks) {
                futures.add(pool.submit(() -> {
                    start.await();
                    try {
                        task.call();
                    } catch (Exception ignored) {
                        // 거절은 정상 결과다. 몇 건이 성공했는지는 DB가 답한다.
                    }
                    return null;
                }));
            }
            start.countDown();
            for (Future<Void> future : futures) {
                future.get(60, TimeUnit.SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }
    }

    private long paidCountFor(List<Long> reservationIds) {
        return reservationRequestRepository.findAllById(reservationIds).stream()
                .filter(r -> r.getStatus() == ReservationStatus.PAID)
                .count();
    }

    private Callable<Void> confirmTask(Long reservationId) {
        PaymentPrepareResponse prepared = paymentService.prepare(brandUserId, reservationId);
        return () -> {
            paymentService.confirm(
                    brandUserId,
                    reservationId,
                    new PaymentConfirmRequest("PAY-" + reservationId, prepared.orderId(), prepared.amount()));
            return null;
        };
    }

    @Test
    @DisplayName("🚨 같은 예약에 동시 결제 승인 → 1건만 PAID가 된다")
    void concurrentConfirm_sameReservation_onlyOneSucceeds() throws Exception {
        Long reservationId = signedReservation(LocalDate.of(2027, 3, 1), LocalDate.of(2027, 3, 10), space.id());
        PaymentPrepareResponse prepared = paymentService.prepare(brandUserId, reservationId);

        List<Callable<Void>> tasks = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            tasks.add(() -> {
                paymentService.confirm(
                        brandUserId,
                        reservationId,
                        new PaymentConfirmRequest("PAY-KEY", prepared.orderId(), prepared.amount()));
                return null;
            });
        }

        raceAll(tasks);

        assertThat(paidCountFor(List.of(reservationId))).isEqualTo(1);
        assertThat(paymentRepository.existsByReservationRequestIdAndStatus(reservationId, PaymentStatus.PAID))
                .isTrue();
    }

    @Test
    @DisplayName("🚨 같은 공간·겹치는 기간에 동시 결제 → 1건만 PAID가 된다")
    void concurrentConfirm_overlappingPeriods_onlyOneSucceeds() throws Exception {
        // 당초 락 키에 기간이 들어 있었다면 이 둘은 서로 다른 락을 잡아 나란히 통과했을 것이다.
        // 인수 조건이 "동일 기간"이라 그 결함은 테스트를 통과하면서 남았을 것이다.
        Long a = signedReservation(LocalDate.of(2027, 4, 1), LocalDate.of(2027, 4, 10), space.id());
        Long b = signedReservation(LocalDate.of(2027, 4, 5), LocalDate.of(2027, 4, 15), space.id());

        raceAll(List.of(confirmTask(a), confirmTask(b)));

        assertThat(paidCountFor(List.of(a, b))).isEqualTo(1);
    }

    @Test
    @DisplayName("겹치지 않는 기간이면 → 둘 다 성공한다(락이 과하게 막지 않는다)")
    void concurrentConfirm_disjointPeriods_bothSucceed() throws Exception {
        // 공간 락이 기간을 무시하므로 직렬화는 되지만 거절되지는 않아야 한다.
        // 이 케이스가 없으면 "전부 거절"도 위 테스트를 통과한다.
        Long a = signedReservation(LocalDate.of(2027, 5, 1), LocalDate.of(2027, 5, 10), space.id());
        Long b = signedReservation(LocalDate.of(2027, 6, 1), LocalDate.of(2027, 6, 10), space.id());

        raceAll(List.of(confirmTask(a), confirmTask(b)));

        assertThat(paidCountFor(List.of(a, b))).isEqualTo(2);
    }
}
