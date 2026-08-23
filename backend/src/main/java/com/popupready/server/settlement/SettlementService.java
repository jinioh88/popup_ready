package com.popupready.server.settlement;

import com.popupready.server.auth.UserService;
import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import com.popupready.server.fixture.FixtureResponse;
import com.popupready.server.fixture.FixtureService;
import com.popupready.server.reservation.LayoutItemDto;
import com.popupready.server.reservation.ReservationRequestResponse;
import com.popupready.server.reservation.ReservationRequestService;
import com.popupready.server.space.SpaceService;
import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 분할 정산 Row 생성·조회(US-203).
 *
 * <p>분배 규칙 자체는 {@link SettlementSplitter}(순수 함수)가 안다. 여기서 하는 일은
 * <b>입력을 모으는 것</b>이다 — 건물주·공급사·플랫폼이 각각 누구인지, 공급사별 렌털료가 얼마인지.
 *
 * <p>Row 생성은 <b>결제 승인과 같은 트랜잭션</b>에서 일어난다. 결제만 남고 정산 Row가 없는
 * 상태를 만들지 않는다.
 */
@Service
@Transactional(readOnly = true)
public class SettlementService {

    private final SpaceService spaceService;
    private final FixtureService fixtureService;
    private final UserService userService;
    private final SettlementRepository settlementRepository;
    private final ReservationRequestService reservationLookup;
    private final PaidPaymentLookup paymentLookup;
    private final BigDecimal platformFeeRate;
    private final String platformPayeeEmail;

    public SettlementService(
            SpaceService spaceService,
            FixtureService fixtureService,
            UserService userService,
            SettlementRepository settlementRepository,
            ReservationRequestService reservationLookup,
            PaidPaymentLookup paymentLookup,
            @Value("${popupready.settlement.platform-fee-rate}") BigDecimal platformFeeRate,
            @Value("${popupready.settlement.platform-payee-email}") String platformPayeeEmail) {
        this.spaceService = spaceService;
        this.fixtureService = fixtureService;
        this.userService = userService;
        this.settlementRepository = settlementRepository;
        this.reservationLookup = reservationLookup;
        this.paymentLookup = paymentLookup;
        this.platformFeeRate = platformFeeRate;
        this.platformPayeeEmail = platformPayeeEmail;
    }

    /**
     * 예약 1건의 분할 정산 내역(§2.2-A).
     *
     * <p>인가는 <b>당사자</b> 기준이다 — 브랜드·건물주·해당 공급사 셋이 본다. 역할 하나로 좁힐 수
     * 없으므로 Security가 아니라 여기서 판정한다(Sprint 1 Phase 5의 교훈: 역할로 가를 수 없는
     * 인가는 Security가 못 막는다).
     *
     * <p>공급사는 <b>자기 Row가 있는 경우에만</b> 당사자다. 그러지 않으면 아무 공급사나 남의
     * 예약 정산 내역을 열 수 있다.
     */
    public List<SettlementResponse> findByReservation(long userId, Long reservationRequestId) {
        Long paymentId = paymentLookup.paidPaymentIdOf(reservationRequestId);
        if (paymentId == null) {
            return List.of();
        }
        List<Settlement> rows = settlementRepository.findByPaymentIdOrderByIdAsc(paymentId);
        requireParty(userId, reservationRequestId, rows);
        return rows.stream().map(Settlement::toResponse).toList();
    }

    private void requireParty(long userId, Long reservationRequestId, List<Settlement> rows) {
        ReservationRequestResponse reservation = reservationLookup.snapshot(reservationRequestId);
        boolean brand = reservation.brandUserId() == userId;
        boolean landlord = !brand && userId == spaceService.ownerIdOf(reservation.spaceId());
        boolean vendor = !brand
                && !landlord
                && rows.stream()
                        .anyMatch(row -> row.getType() == SettlementType.FIXTURE_RENTAL && row.getPayeeId() == userId);
        if (!brand && !landlord && !vendor) {
            throw new ApiException(ErrorCode.FORBIDDEN, "이 예약의 정산 당사자가 아닙니다");
        }
    }

    @Transactional
    public List<SettlementResponse> createFor(Long paymentId, ReservationRequestResponse reservation) {
        List<SettlementRow> rows = SettlementSplitter.split(toInput(reservation), platformFeeRate);
        return settlementRepository
                .saveAll(rows.stream().map(row -> Settlement.of(paymentId, row)).toList())
                .stream()
                .map(Settlement::toResponse)
                .toList();
    }

    private SettlementInput toInput(ReservationRequestResponse reservation) {
        return new SettlementInput(
                reservation.estimate().spaceRentTotal(),
                reservation.estimate().fixtureRentalTotal(),
                reservation.estimate().deposit(),
                reservation.estimate().totalAmount(),
                spaceService.ownerIdOf(reservation.spaceId()),
                reservation.brandUserId(),
                platformPayeeId(),
                vendorShares(reservation));
    }

    /**
     * 공급사별 렌털료 합계. 같은 공급사의 집기가 여러 종이면 한 Row로 합쳐진다.
     *
     * <p>일수를 곱하는 순서가 견적과 같아야 한다 — {@code days × Σ(일 렌털료)}를 공급사별로
     * 나눠도 총합은 스냅샷의 {@code fixtureRentalTotal}과 정확히 같다.
     */
    private List<VendorShare> vendorShares(ReservationRequestResponse reservation) {
        List<LayoutItemDto> items = reservation.layout().items();
        if (items.isEmpty()) {
            return List.of();
        }
        Set<Long> fixtureIds =
                items.stream().map(LayoutItemDto::fixtureId).collect(Collectors.toCollection(LinkedHashSet::new));
        Map<Long, Long> vendorByFixture = fixtureService.findVendorIds(fixtureIds);
        Map<Long, Long> dailyFeeByFixture = fixtureService.findAllByIds(fixtureIds).stream()
                .collect(Collectors.toMap(FixtureResponse::id, FixtureResponse::dailyRentalFee));

        int days = reservation.estimate().days();
        Map<Long, Long> dailyByVendor = items.stream()
                .collect(Collectors.groupingBy(
                        item -> vendorByFixture.get(item.fixtureId()),
                        Collectors.summingLong(item -> dailyFeeByFixture.getOrDefault(item.fixtureId(), 0L))));

        return dailyByVendor.entrySet().stream()
                .map(entry -> new VendorShare(entry.getKey(), days * entry.getValue()))
                .toList();
    }

    /**
     * 플랫폼 정산 계정.
     *
     * <p>기동 시 검증하지 않고 여기서 찾는 것은 <b>순서 때문</b>이다 — 개발 시드는
     * {@code ApplicationRunner}로 들어가므로 컨텍스트 기동 시점에는 아직 계정이 없다. 대신
     * 없으면 조용히 null payee로 Row를 만들지 않고 <b>명시적으로 실패</b>시킨다: 정산이 갈 곳을
     * 잃은 채 저장되면 Sprint 3 배치가 그 Row를 영영 처리하지 못한다.
     */
    private Long platformPayeeId() {
        return userService
                .findIdByEmail(platformPayeeEmail)
                .orElseThrow(() -> new ApiException(
                        ErrorCode.INTERNAL_ERROR,
                        "플랫폼 정산 계정(%s)을 찾을 수 없습니다. popupready.settlement.platform-payee-email 설정을 확인하세요"
                                .formatted(platformPayeeEmail)));
    }
}
