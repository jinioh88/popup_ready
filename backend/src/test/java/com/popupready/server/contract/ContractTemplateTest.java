package com.popupready.server.contract;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 표준 계약 템플릿 리소스(US-202). <b>법률 세이프가드가 걸린 파일이다</b> — 계약 명칭과 필수 조항
 * 문구는 상가건물 임대차보호법상 일시사용 임대차 인정 요건을 계약서에 명문화하기 위한 것이고,
 * 이게 무너지면 계약갱신요구권 배제가 함께 무너진다.
 *
 * <p>그래서 "문구가 들어 있는지"를 테스트가 지킨다. 리소스 파일은 사람이 고치기 쉬운 자리라
 * 코드 리뷰만으로는 조용한 삭제를 못 잡는다.
 */
class ContractTemplateTest {

    private static final ContractTemplate TEMPLATE = ContractTemplate.v1();

    private static String allBodies() {
        return TEMPLATE.clauses().stream().map(ClauseTemplate::body).reduce("", (a, b) -> a + "\n" + b);
    }

    @Test
    @DisplayName("계약 명칭 → '단기 공간사용 제휴계약'으로 고정된다")
    void title_isFixedPartnershipName() {
        // '임대차계약'이 되는 순간 일시사용 요건 논의가 아니라 통상 임대차로 읽힌다.
        assertThat(TEMPLATE.title()).isEqualTo("단기 공간사용 제휴계약");
        assertThat(TEMPLATE.title()).doesNotContain("임대차");
    }

    @Test
    @DisplayName("템플릿 버전 → 스냅샷에 함께 남길 수 있게 노출된다")
    void version_isExposed() {
        assertThat(TEMPLATE.version()).isEqualTo("v1");
    }

    @Test
    @DisplayName("필수 조항 — 일시사용 목적이 명문화된다")
    void clauses_stateTemporaryUsePurpose() {
        assertThat(allBodies()).contains("일시사용");
        assertThat(allBodies()).contains("팝업스토어");
    }

    @Test
    @DisplayName("필수 조항 — 계약갱신요구권을 행사하지 않는다는 동의가 있다")
    void clauses_containRenewalWaiver() {
        // US-202의 핵심 세이프가드. 이 문구가 빠지면 기능 자체가 무의미해진다.
        assertThat(allBodies()).contains("계약갱신요구권");
        assertThat(allBodies()).contains("행사하지 아니한다");
    }

    @Test
    @DisplayName("필수 조항 — 보증금 하향 설계와 정액 일시불 정산이 명시된다")
    void clauses_stateReducedDepositAndLumpSum() {
        assertThat(allBodies()).contains("보증금");
        assertThat(allBodies()).contains("일시불");
    }

    @Test
    @DisplayName("필수 조항 — 구조 변경 금지와 모듈러 집기 한정이 명시된다")
    void clauses_prohibitStructuralChange() {
        assertThat(allBodies()).contains("구조");
        assertThat(allBodies()).contains("모듈러");
    }

    @Test
    @DisplayName("조항은 비어 있지 않고 제목·전문을 모두 갖는다")
    void clauses_allHaveTitleAndBody() {
        assertThat(TEMPLATE.clauses()).isNotEmpty().allSatisfy(clause -> {
            assertThat(clause.title()).isNotBlank();
            assertThat(clause.body()).isNotBlank();
        });
    }

    @Test
    @DisplayName("템플릿이 쓰는 치환 변수 → 바인딩이 아는 이름만 쓴다")
    void clauses_useOnlyKnownPlaceholders() {
        // 리소스에 오타난 변수를 넣으면 생성 시점에야 터진다. 여기서 먼저 잡는다.
        assertThat(TEMPLATE.placeholders()).isSubsetOf(ContractBinding.VARIABLE_NAMES);
    }

    @Test
    @DisplayName("알 수 없는 버전 요청 → 조용히 넘어가지 않고 실패한다")
    void of_unknownVersion_fails() {
        assertThatThrownBy(() -> ContractTemplate.of("v99")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("조항 목록은 불변 → 호출자가 계약 문구를 바꿔치기할 수 없다")
    void clauses_areImmutable() {
        List<ClauseTemplate> clauses = TEMPLATE.clauses();

        assertThatThrownBy(() -> clauses.add(new ClauseTemplate("제99조 (위조)", "본 조항은 위조되었다.")))
                .isInstanceOf(UnsupportedOperationException.class);
    }
}
