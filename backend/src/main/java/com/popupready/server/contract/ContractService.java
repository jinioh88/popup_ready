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
     * <p>브랜드와 건물주 중 한쪽만 부를 수 있다. 웹은 라우트 진입만으로 이 POST를 쏘므로,
     * 임의의 예약 ID로 URL을 두드리면 남의 예약에 계약이 붙는 경로가 된다 — 서버측 당사자
     * 검증이 그 유일한 방어선이다.
     *
     * <p>예약 하나에 계약은 하나다. 이미 있으면 조용히 기존 것을 돌려주지 않고 409를 낸다 —
     * 그렇게 하면 더블 서브밋 버그가 정상 동작으로 위장되고, 웹은 재진입 시
     * {@link #findByReservation}을 쓰면 된다.
     */
    public ContractResponse create(Long reservationRequestId, long userId) {
        ReservationParties reservation = reservationRequestService.findParties(reservationRequestId);
        ContractParties parties = partyLookup.of(reservation);
        // 자격 확인이 중복 확인보다 먼저다. 순서를 바꾸면 제3자가 409/403의 차이로
        // "저 예약에 계약이 있는가"를 알아낼 수 있다.
        requireParty(parties.brandUserId(), parties.landlordUserId(), userId);

        if (contractRepository.existsByReservationRequestId(reservationRequestId)) {
            throw new ApiException(ErrorCode.CONTRACT_ALREADY_EXISTS, "이 예약 요청에는 이미 계약이 있습니다");
        }

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
    public ContractResponse findByReservation(Long reservationRequestId, long userId) {
        Contract contract = contractRepository
                .findByReservationRequestId(reservationRequestId)
                .orElseThrow(() -> new ApiException(ErrorCode.CONTRACT_NOT_FOUND, "이 예약 요청에는 아직 계약이 없습니다"));
        requireParty(contract, userId);
        return toResponse(contract);
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
        requireParty(contract.getBrandUserId(), contract.getLandlordUserId(), userId);
    }

    /**
     * 브랜드도 건물주도 아니면 막는다.
     *
     * <p><b>이 검사가 계약 경로의 유일한 방어선이다.</b> Security 설정은 '인증됐는가'까지만 보는데,
     * 계약은 역할로 가를 수 없기 때문이다 — 브랜드도 건물주도 접근해야 한다. 그래서 세 경로
     * (생성·조회·서명)가 전부 여기를 지난다. 빠지면 아무 로그인 계정이나 예약 ID만 바꿔가며
     * 남의 계약 전문을 읽거나 계약을 만들어 붙일 수 있다.
     */
    private static void requireParty(Long brandUserId, Long landlordUserId, long userId) {
        if (brandUserId != userId && landlordUserId != userId) {
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
