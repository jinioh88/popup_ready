package com.popupready.server.contract;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;

/** 영속 왕복과 유일성 제약만 확인한다. 서명 규칙은 DB가 필요 없어 {@link ContractTest}가 맡는다. */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class ContractRepositoryTest {

    // 시드·다른 테스트와 겹치지 않는 예약 ID 네임스페이스를 쓴다.
    private static final long RESERVATION_ID = 900_001L;

    private static final Instant ISSUED_AT = Instant.parse("2026-08-23T05:12:31Z");

    @Autowired
    private ContractRepository contractRepository;

    private static Contract contract(long reservationRequestId) {
        return Contract.create(
                reservationRequestId,
                11L,
                22L,
                "v1",
                List.of(
                        new ClauseDto("제1조 (목적)", "본 계약은 일시사용에 관한 것이다."),
                        new ClauseDto("제3조 (계약갱신요구권의 불행사)", "행사하지 아니한다.")),
                ISSUED_AT);
    }

    @Test
    @DisplayName("계약 저장 → 식별자가 부여되고 조회로 왕복된다")
    void save_assignsIdAndRoundTrips() {
        Contract saved = contractRepository.save(contract(RESERVATION_ID));

        assertThat(saved.getId()).isNotNull();
        assertThat(contractRepository.findById(saved.getId())).isPresent();
    }

    @Test
    @DisplayName("JSONB 조항 스냅샷 → 제목·전문이 순서까지 그대로 왕복된다")
    void save_roundTripsClausesAsJsonb() {
        Contract saved = contractRepository.save(contract(RESERVATION_ID + 1));
        contractRepository.flush();

        assertThat(contractRepository.findById(saved.getId()))
                .get()
                .extracting(Contract::getClauses)
                .isEqualTo(contract(RESERVATION_ID + 1).getClauses());
    }

    @Test
    @DisplayName("왕복한 계약 → 해시 재계산이 저장된 값과 일치한다")
    void save_roundTripKeepsContentIntact() {
        // 직렬화·역직렬화가 문구를 한 글자라도 바꾸면 여기서 드러난다.
        Contract saved = contractRepository.save(contract(RESERVATION_ID + 2));
        contractRepository.flush();

        assertThat(contractRepository.findById(saved.getId())).get().matches(Contract::hasIntactContent, "해시 재계산 일치");
    }

    @Test
    @DisplayName("예약 ID로 계약 조회 → 재진입 시 기존 계약을 되찾는다")
    void findByReservationRequestId_findsExisting() {
        contractRepository.save(contract(RESERVATION_ID + 3));

        assertThat(contractRepository.findByReservationRequestId(RESERVATION_ID + 3))
                .isPresent();
    }

    @Test
    @DisplayName("계약이 없는 예약 → 빈 결과다(404로 이어진다)")
    void findByReservationRequestId_missing_isEmpty() {
        assertThat(contractRepository.findByReservationRequestId(RESERVATION_ID + 99))
                .isEmpty();
    }

    @Test
    @DisplayName("같은 예약에 계약 두 건 → 유일성 제약이 막는다")
    void save_duplicateReservation_isRejectedByConstraint() {
        // 서비스가 409로 막지만, 경쟁 상황에서 둘 다 통과하면 DB가 마지막 문이다.
        contractRepository.saveAndFlush(contract(RESERVATION_ID + 4));

        assertThatThrownBy(() -> contractRepository.saveAndFlush(contract(RESERVATION_ID + 4)))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
}
