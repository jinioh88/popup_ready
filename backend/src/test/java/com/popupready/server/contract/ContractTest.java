package com.popupready.server.contract;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 계약 상태 전이와 당사자 규칙(US-202). DB가 필요 없는 순수 도메인 규칙이라 영속 계층에 얹지 않는다.
 *
 * <p>서명은 <b>로그인 세션 기반 클릭 서명</b>으로 갈음한다(스코프 결정) — 외부 전자서명 연동은
 * MVP 범위 밖이다. 그래서 "누가 서명할 수 있는가"를 엔티티가 직접 지키는 것이 유일한 방어선이다.
 */
class ContractTest {

    private static final long BRAND_USER_ID = 11L;

    private static final long LANDLORD_USER_ID = 22L;

    private static final Instant ISSUED_AT = Instant.parse("2026-08-23T05:12:31Z");

    private static final List<ClauseDto> CLAUSES = List.of(new ClauseDto("제1조 (목적)", "본 계약은 일시사용에 관한 것이다."));

    private static Contract contract() {
        return Contract.create(1L, BRAND_USER_ID, LANDLORD_USER_ID, "v1", CLAUSES, ISSUED_AT);
    }

    @Test
    @DisplayName("새 계약 → PENDING이고 양측 서명 시각이 비어 있다")
    void create_startsPendingWithoutSignatures() {
        Contract contract = contract();

        assertThat(contract.getStatus()).isEqualTo(ContractStatus.PENDING);
        assertThat(contract.getBrandSignedAt()).isNull();
        assertThat(contract.getLandlordSignedAt()).isNull();
    }

    @Test
    @DisplayName("새 계약 → 조항 전문에서 계산한 무결성 해시를 갖는다")
    void create_computesContentHash() {
        assertThat(contract().getContentHash()).isEqualTo(ContractHasher.hash("v1", 1L, CLAUSES, ISSUED_AT));
    }

    @Test
    @DisplayName("브랜드만 서명 → 아직 PENDING이다")
    void sign_onlyBrand_staysPending() {
        Contract contract = contract();

        contract.sign(BRAND_USER_ID, ISSUED_AT.plusSeconds(60));

        assertThat(contract.getBrandSignedAt()).isEqualTo(ISSUED_AT.plusSeconds(60));
        assertThat(contract.getStatus()).isEqualTo(ContractStatus.PENDING);
    }

    @Test
    @DisplayName("건물주만 서명 → 아직 PENDING이다")
    void sign_onlyLandlord_staysPending() {
        Contract contract = contract();

        contract.sign(LANDLORD_USER_ID, ISSUED_AT.plusSeconds(60));

        assertThat(contract.getLandlordSignedAt()).isNotNull();
        assertThat(contract.getStatus()).isEqualTo(ContractStatus.PENDING);
    }

    @Test
    @DisplayName("양측 서명 완료 → SIGNED로 전이한다")
    void sign_bothParties_becomesSigned() {
        Contract contract = contract();

        contract.sign(BRAND_USER_ID, ISSUED_AT.plusSeconds(60));
        contract.sign(LANDLORD_USER_ID, ISSUED_AT.plusSeconds(120));

        assertThat(contract.getStatus()).isEqualTo(ContractStatus.SIGNED);
    }

    @Test
    @DisplayName("당사자가 아닌 사용자가 서명 → 거부한다")
    void sign_byNonParty_isRejected() {
        assertThatThrownBy(() -> contract().sign(999L, ISSUED_AT))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.NOT_CONTRACT_PARTY);
    }

    @Test
    @DisplayName("같은 당사자가 두 번 서명 → 거부하고 첫 서명 시각을 지킨다")
    void sign_twiceBySameParty_isRejected() {
        Contract contract = contract();
        Instant first = ISSUED_AT.plusSeconds(60);
        contract.sign(BRAND_USER_ID, first);

        assertThatThrownBy(() -> contract.sign(BRAND_USER_ID, ISSUED_AT.plusSeconds(600)))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.CONTRACT_ALREADY_SIGNED);
        assertThat(contract.getBrandSignedAt()).isEqualTo(first);
    }

    @Test
    @DisplayName("서명이 끝난 계약에 다시 서명 → 거부한다")
    void sign_afterFullySigned_isRejected() {
        Contract contract = contract();
        contract.sign(BRAND_USER_ID, ISSUED_AT.plusSeconds(60));
        contract.sign(LANDLORD_USER_ID, ISSUED_AT.plusSeconds(120));

        assertThatThrownBy(() -> contract.sign(BRAND_USER_ID, ISSUED_AT.plusSeconds(180)))
                .isInstanceOf(ApiException.class);
    }

    @Test
    @DisplayName("한 사람이 양쪽 당사자 → 한 번 서명으로 양측이 채워진다")
    void sign_whenSamePersonIsBothParties_completesAtOnce() {
        // 개발 시드처럼 브랜드와 건물주가 같은 계정인 경우가 실제로 생긴다. 이때 조용히
        // 절반만 서명된 채 멈추면 데모가 막힌다.
        Contract selfDeal = Contract.create(1L, BRAND_USER_ID, BRAND_USER_ID, "v1", CLAUSES, ISSUED_AT);

        selfDeal.sign(BRAND_USER_ID, ISSUED_AT.plusSeconds(60));

        assertThat(selfDeal.getStatus()).isEqualTo(ContractStatus.SIGNED);
    }

    @Test
    @DisplayName("서명해도 조항 전문과 해시는 변하지 않는다")
    void sign_doesNotAlterSnapshotOrHash() {
        Contract contract = contract();
        String before = contract.getContentHash();

        contract.sign(BRAND_USER_ID, ISSUED_AT.plusSeconds(60));

        assertThat(contract.getContentHash()).isEqualTo(before);
        assertThat(contract.getClauses()).isEqualTo(CLAUSES);
    }

    @Test
    @DisplayName("저장된 해시 재계산 → 스냅샷과 일치한다(무결성 검증 경로)")
    void verifyIntegrity_recomputedHashMatches() {
        Contract contract = contract();

        assertThat(contract.hasIntactContent()).isTrue();
    }
}
