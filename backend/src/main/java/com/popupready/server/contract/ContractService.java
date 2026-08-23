package com.popupready.server.contract;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import com.popupready.server.reservation.ReservationParties;
import com.popupready.server.reservation.ReservationRequestService;
import java.time.Instant;
import java.util.List;
import java.util.function.Supplier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 계약 생성·서명·열람 유스케이스(US-202).
 *
 * <p>문구·해시·서명 규칙은 여기 없다 — {@link ContractTemplate}·{@link ClauseBinder}·
 * {@link ContractHasher}와 {@link Contract} 엔티티가 각각 맡는다. 여기 남은 것은 순서다.
 *
 * <p>시각을 {@link Supplier}로 주입받는 것은 해시가 발행 시각에 묶여 있기 때문이다 —
 * 테스트가 시각을 고정할 수 없으면 해시를 단정할 수 없다.
 */
@Service
@Transactional
public class ContractService {

    private final ContractRepository contractRepository;

    private final ReservationRequestService reservationRequestService;

    private final ContractPartyLookup partyLookup;

    private final Supplier<Instant> clock;

    public ContractService(
            ContractRepository contractRepository,
            ReservationRequestService reservationRequestService,
            ContractPartyLookup partyLookup,
            Supplier<Instant> clock) {
        this.contractRepository = contractRepository;
        this.reservationRequestService = reservationRequestService;
        this.partyLookup = partyLookup;
        this.clock = clock;
    }

    /**
     * 예약 요청 데이터를 표준 템플릿에 바인딩해 조항 전문을 스냅샷으로 저장한다.
     *
     * <p>예약 하나에 계약은 하나다. 이미 있으면 조용히 기존 것을 돌려주지 않고 409를 낸다 —
     * 그렇게 하면 더블 서브밋 버그가 정상 동작으로 위장되고, 웹은 재진입 시
     * {@link #findByReservation}을 쓰면 된다.
     */
    public ContractResponse create(Long reservationRequestId) {
        if (contractRepository.existsByReservationRequestId(reservationRequestId)) {
            throw new ApiException(ErrorCode.CONTRACT_ALREADY_EXISTS, "이 예약 요청에는 이미 계약이 있습니다");
        }
        ReservationParties reservation = reservationRequestService.findParties(reservationRequestId);
        ContractParties parties = partyLookup.of(reservation);

        List<ClauseDto> clauses = ClauseBinder.bind(ContractTemplate.v1().clauses(), binding(reservation, parties));
        Contract contract = contractRepository.save(Contract.create(
                reservationRequestId,
                parties.brandUserId(),
                parties.landlordUserId(),
                ContractTemplate.CURRENT_VERSION,
                clauses,
                clock.get()));

        reservationRequestService.markContractPending(reservationRequestId);
        return toResponse(contract);
    }

    /** 재진입 경로. 계약이 없으면 404이며, 웹은 그때 생성 POST를 쏜다. */
    @Transactional(readOnly = true)
    public ContractResponse findByReservation(Long reservationRequestId) {
        return toResponse(contractRepository
                .findByReservationRequestId(reservationRequestId)
                .orElseThrow(() -> new ApiException(ErrorCode.CONTRACT_NOT_FOUND, "이 예약 요청에는 아직 계약이 없습니다")));
    }

    /** 클릭 서명. 당사자 판정과 중복 서명 판정은 엔티티가 한다. */
    public ContractResponse sign(Long contractId, long userId) {
        Contract contract = require(contractId);
        contract.sign(userId, clock.get());
        if (contract.isFullySigned()) {
            reservationRequestService.markContractSigned(contract.getReservationRequestId());
        }
        return toResponse(contract);
    }

    /** 열람. 소명 자료는 당사자의 것이므로 제3자에게는 열지 않는다. */
    @Transactional(readOnly = true)
    public ContractResponse detail(Long contractId, long userId) {
        Contract contract = require(contractId);
        requireParty(contract, userId);
        return toResponse(contract);
    }

    private Contract require(Long contractId) {
        return contractRepository
                .findById(contractId)
                .orElseThrow(() -> new ApiException(ErrorCode.CONTRACT_NOT_FOUND, "계약을 찾을 수 없습니다"));
    }

    private static void requireParty(Contract contract, long userId) {
        boolean isParty = contract.getBrandUserId() == userId || contract.getLandlordUserId() == userId;
        if (!isParty) {
            throw new ApiException(ErrorCode.NOT_CONTRACT_PARTY, "이 계약의 당사자가 아닙니다");
        }
    }

    private static ContractBinding binding(ReservationParties reservation, ContractParties parties) {
        return new ContractBinding(
                parties.spaceName(),
                parties.spaceAddress(),
                parties.brandName(),
                parties.landlordName(),
                reservation.startDate(),
                reservation.endDate(),
                reservation.days(),
                reservation.spaceRentTotal(),
                reservation.deposit(),
                reservation.totalAmount());
    }

    private static ContractResponse toResponse(Contract contract) {
        return new ContractResponse(
                contract.getId(),
                contract.getReservationRequestId(),
                ContractTemplate.TITLE,
                contract.getTemplateVersion(),
                contract.getClauses(),
                contract.getContentHash(),
                contract.getBrandSignedAt(),
                contract.getLandlordSignedAt(),
                contract.getStatus());
    }
}
