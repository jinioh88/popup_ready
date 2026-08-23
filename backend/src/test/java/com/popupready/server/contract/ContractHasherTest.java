package com.popupready.server.contract;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 조항 전문 + 발행 시각의 SHA-256 무결성 해시(PRD §4 "암호화 타임스탬프").
 *
 * <p>이 해시가 하는 일은 하나다 — <b>"이 문서가 이 시점에 이 내용이었다"를 나중에 다시 증명하는 것.</b>
 * 그러려면 같은 입력에서 언제나 같은 값이 나와야 하고(재현), 한 글자라도 달라지면 값이 달라져야 한다(감지).
 * 두 성질을 테스트가 지킨다.
 */
class ContractHasherTest {

    private static final Instant ISSUED_AT = Instant.parse("2026-08-23T05:12:31Z");

    private static final List<ClauseDto> CLAUSES =
            List.of(new ClauseDto("제1조 (목적)", "본 계약은 일시사용에 관한 것이다."), new ClauseDto("제2조 (사용 기간)", "14일간으로 한다."));

    private static String hash(List<ClauseDto> clauses, Instant issuedAt) {
        return ContractHasher.hash("v1", 1L, clauses, issuedAt);
    }

    @Test
    @DisplayName("같은 입력 → 같은 해시(재계산으로 무결성을 검증할 수 있다)")
    void hash_isDeterministic() {
        assertThat(hash(CLAUSES, ISSUED_AT)).isEqualTo(hash(CLAUSES, ISSUED_AT));
    }

    @Test
    @DisplayName("해시 형식 → 소문자 16진수 64자(SHA-256)")
    void hash_isLowercaseHexOf64Chars() {
        assertThat(hash(CLAUSES, ISSUED_AT)).hasSize(64).matches("[0-9a-f]{64}");
    }

    @Test
    @DisplayName("조항 전문이 한 글자 바뀜 → 해시가 달라진다")
    void hash_changesWhenBodyChanges() {
        List<ClauseDto> tampered = List.of(CLAUSES.getFirst(), new ClauseDto("제2조 (사용 기간)", "15일간으로 한다."));

        assertThat(hash(tampered, ISSUED_AT)).isNotEqualTo(hash(CLAUSES, ISSUED_AT));
    }

    @Test
    @DisplayName("조항 제목만 바뀜 → 해시가 달라진다")
    void hash_changesWhenTitleChanges() {
        List<ClauseDto> tampered =
                List.of(new ClauseDto("제1조 (변조)", CLAUSES.getFirst().body()), CLAUSES.get(1));

        assertThat(hash(tampered, ISSUED_AT)).isNotEqualTo(hash(CLAUSES, ISSUED_AT));
    }

    @Test
    @DisplayName("조항 순서가 바뀜 → 해시가 달라진다")
    void hash_changesWhenOrderChanges() {
        assertThat(hash(List.of(CLAUSES.get(1), CLAUSES.get(0)), ISSUED_AT)).isNotEqualTo(hash(CLAUSES, ISSUED_AT));
    }

    @Test
    @DisplayName("발행 시각이 바뀜 → 해시가 달라진다(타임스탬프가 해시에 묶인다)")
    void hash_changesWhenIssuedAtChanges() {
        assertThat(hash(CLAUSES, ISSUED_AT.plusSeconds(1))).isNotEqualTo(hash(CLAUSES, ISSUED_AT));
    }

    @Test
    @DisplayName("템플릿 버전이 바뀜 → 해시가 달라진다")
    void hash_changesWhenTemplateVersionChanges() {
        assertThat(ContractHasher.hash("v2", 1L, CLAUSES, ISSUED_AT))
                .isNotEqualTo(ContractHasher.hash("v1", 1L, CLAUSES, ISSUED_AT));
    }

    @Test
    @DisplayName("대상 예약이 다름 → 해시가 달라진다(같은 문구라도 다른 계약이다)")
    void hash_changesWhenReservationChanges() {
        assertThat(ContractHasher.hash("v1", 2L, CLAUSES, ISSUED_AT))
                .isNotEqualTo(ContractHasher.hash("v1", 1L, CLAUSES, ISSUED_AT));
    }

    @Test
    @DisplayName("경계가 밀린 조항 → 이어붙이기 착시로 같은 해시가 나오지 않는다")
    void hash_isNotFooledByFieldBoundaryShift() {
        // 구분자 없이 이어붙이면 ("ab","c")와 ("a","bc")가 같은 입력이 된다. 계약 문구를
        // 조항 경계만 옮겨 위조하는 경로라 구분자가 반드시 필요하다.
        List<ClauseDto> shifted = List.of(new ClauseDto("제1조 (목적)본 계약은", " 일시사용에 관한 것이다."), CLAUSES.get(1));

        assertThat(hash(shifted, ISSUED_AT)).isNotEqualTo(hash(CLAUSES, ISSUED_AT));
    }
}
