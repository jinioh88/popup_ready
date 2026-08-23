package com.popupready.server.reservation;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import com.popupready.server.fixture.FixtureResponse;
import com.popupready.server.fixture.FixtureService;
import com.popupready.server.space.SpaceDetailResponse;
import com.popupready.server.space.SpaceService;
import com.popupready.server.space.SpaceStatus;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 예약 요청 생성 유스케이스(스프린트 문서 §4 기반 6번).
 *
 * <p>판정과 계산은 전부 순수 클래스가 맡는다 — {@link LayoutValidator}(도면 재검증),
 * {@link EstimateCalculator}(견적), {@link ReservationPeriod}(기간). 여기 남은 것은 <b>순서</b>다:
 * 무엇을 어떤 순서로 확인하고, 거절되면 아무것도 저장하지 않는다.
 *
 * <p>공간·집기 정보는 각 도메인의 서비스를 통해서만 읽는다(패키지 경계 규칙). 그쪽 엔티티나
 * 리포지토리를 직접 만지지 않으므로, 그 도메인이 저장 방식을 바꿔도 여기는 영향을 받지 않는다.
 */
@Service
@Transactional
public class ReservationRequestService {

    private final SpaceService spaceService;

    private final FixtureService fixtureService;

    private final ReservationRequestRepository reservationRequestRepository;

    public ReservationRequestService(
            SpaceService spaceService,
            FixtureService fixtureService,
            ReservationRequestRepository reservationRequestRepository) {
        this.spaceService = spaceService;
        this.fixtureService = fixtureService;
        this.reservationRequestRepository = reservationRequestRepository;
    }

    /**
     * @param brandUserId 요청자. 본문이 아니라 <b>토큰</b>에서 온다 — 본문에서 받으면 남의 이름으로 예약할 수 있다
     */
    public ReservationRequestResponse create(long brandUserId, CreateReservationRequest request) {
        // 기간이 먼저다. 뒤집힌 날짜는 조회를 해봐야 결론이 같으므로 DB를 건드리기 전에 끊는다.
        ReservationPeriod period = ReservationPeriod.of(request.startDate(), request.endDate());

        SpaceDetailResponse space = spaceService.detail(request.spaceId());
        requireBookable(space);

        LayoutDto layout = request.layout();
        Map<Long, FixtureSpec> catalog = catalogFor(layout);
        LayoutValidator.validate(layout, gridOf(space), space.maxPowerWatt(), catalog);

        EstimateResponse estimate = EstimateCalculator.calculate(
                period, space.dailyRent(), space.depositRate(), placedFixtures(layout, catalog));

        ReservationRequest saved = reservationRequestRepository.save(ReservationRequest.create(
                space.id(), brandUserId, period.startDate(), period.endDate(), layout, estimate));

        return toResponse(saved);
    }

    /**
     * 계약 바인딩용 읽기 모델(US-202). {@code contract}가 예약을 들여다보는 유일한 창구다.
     *
     * <p>금액은 저장된 값을 그대로 옮긴다 — 여기서 다시 계산하면 계약서와 예약 금액이 갈라진다.
     */
    @Transactional(readOnly = true)
    public ReservationParties findParties(Long reservationRequestId) {
        ReservationRequest request = require(reservationRequestId);
        EstimateResponse estimate = request.getEstimate();
        return new ReservationParties(
                request.getId(),
                request.getSpaceId(),
                request.getBrandUserId(),
                request.getStartDate(),
                request.getEndDate(),
                estimate.days(),
                estimate.spaceRentTotal(),
                estimate.deposit(),
                estimate.totalAmount());
    }

    /**
     * 예약 요청 단건 조회(§2.2-A). 재진입·결제 화면·모바일 예약 목록이 공유하는 단일 조회 경로다.
     *
     * <p>금액은 저장된 스냅샷을 그대로 옮긴다 — 여기서 재계산하면 배치 단계에서 본 견적과 결제
     * 화면의 금액이 갈라진다(§2.2-E).
     *
     * <p>인가는 <b>역할이 아니라 당사자</b>로 판정한다. 브랜드도 건물주도 같은 예약을 보므로
     * Security 설정으로는 가를 수 없고, 서비스가 막아야 한다(Sprint 1 Phase 5의 교훈).
     */
    @Transactional(readOnly = true)
    public ReservationRequestResponse detail(long userId, Long reservationRequestId) {
        ReservationRequest request = require(reservationRequestId);
        requireParty(request, userId);
        return toResponse(request);
    }

    /**
     * 내 예약 목록(§2.2-A, 2026-08-23 추가). 모바일의 진입 경로다 — 현장 운영자가 예약 ID를
     * 외우지 않으므로 단건 조회만으로는 예약 상세에 닿을 방법이 없다.
     *
     * <p><b>돌려주는 것은 "내가 만든 예약"뿐이다.</b> 건물주의 "내 공간에 걸린 예약 목록"은
     * 조회 축이 다른 별개의 유스케이스이며, 두 가지를 한 경로에 합치면 호출자가 무엇을 받는지
     * 역할에 따라 달라져 계약이 모호해진다. 필요해지면 별도 경로로 낸다.
     *
     * @param status null이면 전체
     */
    @Transactional(readOnly = true)
    public List<ReservationRequestResponse> listMine(long brandUserId, ReservationStatus status) {
        List<ReservationRequest> found = (status == null)
                ? reservationRequestRepository.findByBrandUserIdOrderByIdDesc(brandUserId)
                : reservationRequestRepository.findByBrandUserIdAndStatusOrderByIdDesc(brandUserId, status);
        return found.stream().map(ReservationRequestService::toResponse).toList();
    }

    /** 예약의 브랜드 본인이거나 그 공간의 건물주여야 한다. */
    private void requireParty(ReservationRequest request, long userId) {
        boolean brand = request.getBrandUserId() == userId;
        boolean landlord = !brand && spaceService.ownerIdOf(request.getSpaceId()) == userId;
        if (!brand && !landlord) {
            throw new ApiException(ErrorCode.FORBIDDEN, "이 예약 요청의 당사자가 아닙니다");
        }
    }

    /**
     * 도어 개방 판정용 읽기 모델(US-301). {@code door}가 예약을 들여다보는 유일한 창구다.
     *
     * <p>판정(당사자·상태·시간창)은 {@code door}가 한다 — 여기서 하면 예약 서비스가 도어 정책까지
     * 떠안는다. 이 메서드가 하는 일은 판정에 필요한 사실을 그대로 넘기는 것뿐이다.
     */
    @Transactional(readOnly = true)
    public ReservationAccess findForDoorAccess(Long reservationRequestId) {
        ReservationRequest request = require(reservationRequestId);
        return new ReservationAccess(
                request.getId(),
                request.getSpaceId(),
                request.getBrandUserId(),
                request.getStartDate(),
                request.getEndDate(),
                request.getStatus());
    }

    /** 계약서가 만들어졌다(US-202). 잘못된 전이는 엔티티가 막는다. */
    public void markContractPending(Long reservationRequestId) {
        require(reservationRequestId).markContractPending();
    }

    /** 양 당사자 서명이 끝났다(US-202). */
    public void markContractSigned(Long reservationRequestId) {
        require(reservationRequestId).markContractSigned();
    }

    /**
     * 결제 경로가 예약을 들여다보는 창구(US-201). 인가·판정은 하지 않고 저장된 사실만 넘긴다 —
     * 판정을 여기 두면 예약 서비스가 결제 정책까지 떠안는다.
     */
    @Transactional(readOnly = true)
    public ReservationRequestResponse snapshot(Long reservationRequestId) {
        return toResponse(require(reservationRequestId));
    }

    /** 결제 준비가 끝났다(US-201). 잘못된 전이는 엔티티가 막는다. */
    public void markPaymentPending(Long reservationRequestId) {
        require(reservationRequestId).markPaymentPending();
    }

    /** 결제가 승인됐다(US-201). 이 시점부터 공간·집기를 실제로 점유한다. */
    public void markPaid(Long reservationRequestId) {
        require(reservationRequestId).markPaid();
    }

    private ReservationRequest require(Long reservationRequestId) {
        return reservationRequestRepository
                .findById(reservationRequestId)
                .orElseThrow(() -> new ApiException(ErrorCode.RESERVATION_REQUEST_NOT_FOUND, "예약 요청을 찾을 수 없습니다"));
    }

    /** 판정 기준이 되는 도면은 요청이 아니라 공간이 가진 값이다. */
    private static GridSpec gridOf(SpaceDetailResponse space) {
        return new GridSpec(space.gridCols(), space.gridRows(), space.cellSizeMm());
    }

    /**
     * 내려간 공간은 탐색 결과에도 나오지 않는다. 상세 조회는 열려 있으므로 ID를 알면 부를 수 있고,
     * 여기서 막지 않으면 운영이 끝난 공간에 예약과 계약이 걸린다.
     */
    private static void requireBookable(SpaceDetailResponse space) {
        if (space.status() != SpaceStatus.ACTIVE) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "예약할 수 없는 공간입니다 (상태: %s)".formatted(space.status()));
        }
    }

    /** 배치된 집기의 규격표. 빠진 ID의 판정은 {@link LayoutValidator}가 맡는다. */
    private Map<Long, FixtureSpec> catalogFor(LayoutDto layout) {
        Set<Long> fixtureIds = layout.items().stream()
                .map(LayoutItemDto::fixtureId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (fixtureIds.isEmpty()) {
            return Map.of();
        }
        return fixtureService.findAllByIds(fixtureIds).stream()
                .collect(Collectors.toMap(FixtureResponse::id, ReservationRequestService::toSpec));
    }

    /** 배치된 순서대로 규격을 편다. 같은 집기를 2개 놓았으면 두 번 들어간다 — 견적이 그렇게 센다. */
    private static List<FixtureSpec> placedFixtures(LayoutDto layout, Map<Long, FixtureSpec> catalog) {
        return layout.items().stream()
                .map(LayoutItemDto::fixtureId)
                .map(catalog::get)
                .toList();
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

    private static ReservationRequestResponse toResponse(ReservationRequest request) {
        return new ReservationRequestResponse(
                request.getId(),
                request.getSpaceId(),
                request.getBrandUserId(),
                request.getStartDate(),
                request.getEndDate(),
                request.getLayout(),
                request.getEstimate(),
                request.getStatus());
    }
}
