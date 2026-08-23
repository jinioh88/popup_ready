package com.popupready.server.payment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.popupready.server.auth.AuthDevSeeder;
import com.popupready.server.auth.UserService;
import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
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
import com.popupready.server.space.SpaceDetailResponse;
import com.popupready.server.space.SpaceService;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * 결제 입구의 상태 판정(웹 J-0 실서버 점검 반영, 2026-08-23).
 *
 * <p>웹이 화면을 만들기 <b>전에</b> 여섯 경로를 실서버로 밟아 둘을 잡았다. 둘 다 "코드는
 * 도는데 클라이언트가 옳게 행동할 수 없는" 형태다.
 */
@SpringBootTest
class PaymentStateGuardTest {

    private static final int TEST_YEAR = 2028;

    @Autowired
    private PaymentService paymentService;

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

    @BeforeEach
    void setUp() {
        reservationRequestRepository.deleteAll(reservationRequestRepository.findAll().stream()
                .filter(r -> r.getStartDate().getYear() == TEST_YEAR)
                .toList());
        brandUserId = userService.findIdByEmail(AuthDevSeeder.BRAND_EMAIL).orElseThrow();
        space = spaceService.detail(spaceService
                .search(37.5445, 127.0557, 50_000, null, null, null)
                .getFirst()
                .id());
        fixture = fixtureService.list(null).getFirst();
    }

    private Long reservation(LocalDate start, LocalDate end) {
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
        ReservationRequest request = ReservationRequest.create(space.id(), brandUserId, start, end, layout, estimate);
        request.markContractPending();
        request.markContractSigned();
        return reservationRequestRepository.save(request).getId();
    }

    private static ErrorCode codeOf(Throwable thrown) {
        return ((ApiException) thrown).getErrorCode();
    }

    @Test
    @DisplayName("🚨 이미 결제된 예약에 prepare → PAYMENT_ALREADY_COMPLETED (문구가 거짓말하지 않는다)")
    void prepare_afterPaid_reportsAlreadyCompleted() {
        // 웹 제기: PAID인데 "계약 서명이 끝난 예약만 결제할 수 있습니다"가 나갔다. 결제를 마치고
        // 돌아온 사용자가 이걸 보면 서명이 실패한 줄 알고 계약을 다시 서명하려 한다.
        Long id = reservation(LocalDate.of(TEST_YEAR, 3, 1), LocalDate.of(TEST_YEAR, 3, 5));
        PaymentPrepareResponse prepared = paymentService.prepare(brandUserId, id);
        paymentService.confirm(
                brandUserId, id, new PaymentConfirmRequest("PAY-OK", prepared.orderId(), prepared.amount()));

        assertThatThrownBy(() -> paymentService.prepare(brandUserId, id))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.PAYMENT_ALREADY_COMPLETED));
    }

    @Test
    @DisplayName("🚨 소진된 orderId로 confirm → PG를 다시 부르기 전에 409로 끊는다")
    void confirm_withSpentOrderId_isRejectedBeforeGatewayCall() {
        // 웹 제기는 "500이 난다"였지만 실제 문제는 그보다 크다 — 소진 판정이 PG 호출 뒤에 있어
        // **재청구 시도가 먼저 일어난 다음** 엔티티가 거절해 500이 됐다. 판정을 앞으로 옮긴다.
        Long id = reservation(LocalDate.of(TEST_YEAR, 4, 1), LocalDate.of(TEST_YEAR, 4, 5));
        PaymentPrepareResponse prepared = paymentService.prepare(brandUserId, id);
        assertThatThrownBy(() -> paymentService.confirm(
                        brandUserId, id, new PaymentConfirmRequest("DECLINE-1", prepared.orderId(), prepared.amount())))
                .isInstanceOf(ApiException.class);

        // 같은 orderId로 다시 — 이번엔 승인될 키를 써도 소진된 주문이라 거절돼야 한다.
        assertThatThrownBy(() -> paymentService.confirm(
                        brandUserId, id, new PaymentConfirmRequest("PAY-OK", prepared.orderId(), prepared.amount())))
                .isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(codeOf(e)).isEqualTo(ErrorCode.ORDER_ID_ALREADY_USED));
    }

    @Test
    @DisplayName("결제 실패 후 prepare를 다시 부르면 → 새 주문으로 재시도할 수 있다")
    void prepare_afterFailedAttempt_issuesNewOrder() {
        // 재시도 경로가 실제로 열려 있어야 위 두 거절이 막다른 골목이 아니게 된다.
        Long id = reservation(LocalDate.of(TEST_YEAR, 5, 1), LocalDate.of(TEST_YEAR, 5, 5));
        PaymentPrepareResponse first = paymentService.prepare(brandUserId, id);
        assertThatThrownBy(() -> paymentService.confirm(
                        brandUserId, id, new PaymentConfirmRequest("DECLINE-1", first.orderId(), first.amount())))
                .isInstanceOf(ApiException.class);

        PaymentPrepareResponse second = paymentService.prepare(brandUserId, id);

        assertThat(second.orderId()).isNotEqualTo(first.orderId());
        assertThat(paymentService
                        .confirm(
                                brandUserId, id, new PaymentConfirmRequest("PAY-OK", second.orderId(), second.amount()))
                        .status())
                .isEqualTo(PaymentStatus.PAID);
    }
}
