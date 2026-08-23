package com.popupready.server.contract;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import com.popupready.server.reservation.ReservationParties;
import com.popupready.server.reservation.ReservationRequestService;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * 계약 생성·서명·열람 유스케이스(US-202). 조항 문구·해시·서명 규칙은 순수 클래스와 엔티티가
 * 이미 잠갔으므로 여기서는 <b>흐름</b>을 본다: 무엇을 어떤 순서로 확인하고, 예약 상태를 언제 옮기는가.
 */
@ExtendWith(MockitoExtension.class)
class ContractServiceTest {

    private static final long RESERVATION_ID = 1L;
    private static final long BRAND_USER_ID = 11L;
    private static final long LANDLORD_USER_ID = 22L;
    private static final Instant NOW = Instant.parse("2026-08-23T05:12:31Z");

    @Mock
    private ContractRepository contractRepository;

    @Mock
    private ReservationRequestService reservationRequestService;

    @Mock
    private ContractPartyLookup partyLookup;

    private ContractService service() {
        return new ContractService(contractRepository, reservationRequestService, partyLookup, () -> NOW);
    }

    private static ReservationParties parties() {
        return new ReservationParties(
                RESERVATION_ID,
                1L,
                BRAND_USER_ID,
                LocalDate.of(2026, 9, 1),
                LocalDate.of(2026, 9, 14),
                14,
                6_300_000L,
                630_000L,
                7_350_000L);
    }

    private void givenBindableReservation() {
        given(reservationRequestService.findParties(RESERVATION_ID)).willReturn(parties());
        given(partyLookup.of(parties()))
                .willReturn(new ContractParties(
                        BRAND_USER_ID, LANDLORD_USER_ID, "김브랜드", "박건물주", "성수 연무장길 팝업 1층", "서울 성동구 연무장길 45"));
        given(contractRepository.save(any(Contract.class))).willAnswer(call -> call.getArgument(0));
    }

    @Test
    @DisplayName("계약 생성 → 조항 전문 스냅샷과 해시를 담아 돌려준다")
    void create_returnsClauseSnapshotWithHash() {
        givenBindableReservation();

        ContractResponse response = service().create(RESERVATION_ID, BRAND_USER_ID);

        assertThat(response.clauses()).isNotEmpty();
        assertThat(response.contentHash()).matches("[0-9a-f]{64}");
        assertThat(response.status()).isEqualTo(ContractStatus.PENDING);
    }

    @Test
    @DisplayName("계약 생성 → 조항에 미치환 변수가 남지 않는다")
    void create_bindsEveryPlaceholder() {
        givenBindableReservation();

        assertThat(service().create(RESERVATION_ID, BRAND_USER_ID).clauses())
                .allSatisfy(clause -> assertThat(clause.body()).doesNotContain("{{"));
    }

    @Test
    @DisplayName("계약 생성 → 예약 요청이 CONTRACT_PENDING으로 전이한다")
    void create_movesReservationToContractPending() {
        givenBindableReservation();

        service().create(RESERVATION_ID, BRAND_USER_ID);

        verify(reservationRequestService).markContractPending(RESERVATION_ID);
    }

    @Test
    @DisplayName("이미 계약이 있는 예약에 재생성 → 409로 거부하고 저장하지 않는다")
    void create_whenContractExists_isRejected() {
        given(reservationRequestService.findParties(RESERVATION_ID)).willReturn(parties());
        given(partyLookup.of(parties()))
                .willReturn(new ContractParties(
                        BRAND_USER_ID, LANDLORD_USER_ID, "김브랜드", "박건물주", "성수 연무장길 팝업 1층", "서울 성동구 연무장길 45"));
        given(contractRepository.existsByReservationRequestId(RESERVATION_ID)).willReturn(true);

        assertThatThrownBy(() -> service().create(RESERVATION_ID, BRAND_USER_ID))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.CONTRACT_ALREADY_EXISTS);
        verify(contractRepository, never()).save(any());
    }

    @Test
    @DisplayName("예약으로 계약 조회 → 재진입 시 기존 계약을 되찾는다")
    void findByReservation_returnsExisting() {
        Contract existing = contract();
        given(contractRepository.findByReservationRequestId(RESERVATION_ID)).willReturn(Optional.of(existing));

        assertThat(service().findByReservation(RESERVATION_ID, BRAND_USER_ID).reservationRequestId())
                .isEqualTo(RESERVATION_ID);
    }

    @Test
    @DisplayName("계약이 없는 예약 조회 → 404로 알린다(생성 POST를 다시 쏘지 않게)")
    void findByReservation_missing_isNotFound() {
        given(contractRepository.findByReservationRequestId(RESERVATION_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service().findByReservation(RESERVATION_ID, BRAND_USER_ID))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.CONTRACT_NOT_FOUND);
    }

    @Test
    @DisplayName("한쪽만 서명 → 예약 상태는 그대로다")
    void sign_onlyOneParty_doesNotMoveReservation() {
        given(contractRepository.findById(5L)).willReturn(Optional.of(contract()));

        service().sign(5L, BRAND_USER_ID);

        verify(reservationRequestService, never()).markContractSigned(any(Long.class));
    }

    @Test
    @DisplayName("양측 서명 완료 → 예약 요청이 CONTRACT_SIGNED로 전이한다")
    void sign_bothParties_movesReservationToSigned() {
        Contract contract = contract();
        given(contractRepository.findById(5L)).willReturn(Optional.of(contract));
        ContractService service = service();

        service.sign(5L, BRAND_USER_ID);
        service.sign(5L, LANDLORD_USER_ID);

        verify(reservationRequestService).markContractSigned(RESERVATION_ID);
    }

    @Test
    @DisplayName("당사자가 아닌 사용자의 서명 → 403으로 거부한다")
    void sign_byNonParty_isForbidden() {
        given(contractRepository.findById(5L)).willReturn(Optional.of(contract()));

        assertThatThrownBy(() -> service().sign(5L, 999L))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.NOT_CONTRACT_PARTY);
    }

    @Test
    @DisplayName("없는 계약에 서명 → 404")
    void sign_unknownContract_isNotFound() {
        given(contractRepository.findById(5L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service().sign(5L, BRAND_USER_ID))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.CONTRACT_NOT_FOUND);
    }

    @Test
    @DisplayName("계약 열람 → 당사자가 아니면 거부한다(소명 자료는 당사자의 것이다)")
    void detail_byNonParty_isForbidden() {
        given(contractRepository.findById(5L)).willReturn(Optional.of(contract()));

        assertThatThrownBy(() -> service().detail(5L, 999L))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.NOT_CONTRACT_PARTY);
    }

    @Test
    @DisplayName("계약 열람 → 당사자에게는 조항 전문과 해시를 준다")
    void detail_byParty_returnsSnapshot() {
        given(contractRepository.findById(5L)).willReturn(Optional.of(contract()));

        assertThat(service().detail(5L, LANDLORD_USER_ID).contentHash()).matches("[0-9a-f]{64}");
    }

    private static Contract contract() {
        return Contract.create(
                RESERVATION_ID,
                BRAND_USER_ID,
                LANDLORD_USER_ID,
                ContractTemplate.CURRENT_VERSION,
                ClauseBinder.bind(
                        ContractTemplate.v1().clauses(),
                        new ContractBinding(
                                "성수 연무장길 팝업 1층",
                                "서울 성동구 연무장길 45",
                                "김브랜드",
                                "박건물주",
                                LocalDate.of(2026, 9, 1),
                                LocalDate.of(2026, 9, 14),
                                14,
                                6_300_000L,
                                630_000L,
                                7_350_000L)),
                NOW);
    }

    @Test
    @DisplayName("제3자가 남의 예약으로 계약 생성 → 403으로 거부한다")
    void create_byNonParty_isForbidden() {
        // Security는 '인증됐는가'까지만 본다. 여기서 막지 않으면 아무 로그인 계정이나
        // 남의 예약에 계약을 만들어 붙일 수 있다.
        given(reservationRequestService.findParties(RESERVATION_ID)).willReturn(parties());
        given(partyLookup.of(parties()))
                .willReturn(new ContractParties(
                        BRAND_USER_ID, LANDLORD_USER_ID, "김브랜드", "박건물주", "성수 연무장길 팝업 1층", "서울 성동구 연무장길 45"));

        assertThatThrownBy(() -> service().create(RESERVATION_ID, 999L))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.NOT_CONTRACT_PARTY);
        verify(contractRepository, never()).save(any());
    }

    @Test
    @DisplayName("건물주도 계약을 생성할 수 있다(양쪽 모두 당사자다)")
    void create_byLandlord_isAllowed() {
        givenBindableReservation();

        assertThat(service().create(RESERVATION_ID, LANDLORD_USER_ID).status()).isEqualTo(ContractStatus.PENDING);
    }

    @Test
    @DisplayName("제3자가 예약으로 계약 조회 → 403으로 거부한다(계약 전문이 새면 안 된다)")
    void findByReservation_byNonParty_isForbidden() {
        // contractId를 몰라도 reservationId만 알면 계약 전문을 통째로 읽을 수 있는 경로였다.
        given(contractRepository.findByReservationRequestId(RESERVATION_ID)).willReturn(Optional.of(contract()));

        assertThatThrownBy(() -> service().findByReservation(RESERVATION_ID, 999L))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.NOT_CONTRACT_PARTY);
    }
}
