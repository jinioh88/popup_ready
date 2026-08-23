package com.popupready.server.contract;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 템플릿 치환. 의존성 없는 순수 함수라 스텁 없이 검증한다.
 *
 * <p>가장 중요한 규칙은 <b>미치환 변수를 통과시키지 않는 것</b>이다. 계약서 전문에
 * {@code {{brandName}}}이 그대로 남으면 소명 자료로서 결함이고, 조용히 통과하면 서명까지 끝난 뒤에야
 * 발견된다.
 */
class ClauseBinderTest {

    private static final ContractBinding BINDING = new ContractBinding(
            "성수 연무장길 팝업 1층",
            "서울 성동구 연무장길 45",
            "김브랜드",
            "박건물주",
            LocalDate.of(2026, 9, 1),
            LocalDate.of(2026, 9, 14),
            14,
            6_300_000L,
            630_000L,
            7_350_000L);

    private static String bindBody(String body) {
        return ClauseBinder.bind(List.of(new ClauseTemplate("제1조 (목적)", body)), BINDING)
                .getFirst()
                .body();
    }

    @Test
    @DisplayName("변수가 없는 조항 → 문구가 그대로 남는다")
    void bind_withoutPlaceholders_keepsText() {
        assertThat(bindBody("본 계약은 일시사용에 관한 것이다.")).isEqualTo("본 계약은 일시사용에 관한 것이다.");
    }

    @Test
    @DisplayName("조항 제목도 치환 대상이다")
    void bind_substitutesTitleToo() {
        List<ClauseDto> bound = ClauseBinder.bind(List.of(new ClauseTemplate("제2조 ({{spaceName}})", "본문")), BINDING);

        assertThat(bound.getFirst().title()).isEqualTo("제2조 (성수 연무장길 팝업 1층)");
    }

    @Test
    @DisplayName("당사자·공간 변수 → 예약 데이터로 치환된다")
    void bind_substitutesPartiesAndSpace() {
        String bound =
                bindBody("{{brandName}}(이하 '사용자')와 {{landlordName}}은 {{spaceName}}({{spaceAddress}})에 관하여 합의한다.");

        assertThat(bound).isEqualTo("김브랜드(이하 '사용자')와 박건물주은 성수 연무장길 팝업 1층(서울 성동구 연무장길 45)에 관하여 합의한다.");
    }

    @Test
    @DisplayName("기간 변수 → yyyy-MM-dd와 일수로 치환된다")
    void bind_substitutesPeriod() {
        assertThat(bindBody("{{startDate}}부터 {{endDate}}까지 {{days}}일간")).isEqualTo("2026-09-01부터 2026-09-14까지 14일간");
    }

    @Test
    @DisplayName("금액 변수 → 천 단위 구분 기호가 붙는다")
    void bind_formatsMoneyWithGrouping() {
        // 계약서는 사람이 읽는 문서다. 7350000원이 아니라 7,350,000원으로 적힌다.
        assertThat(bindBody("사용료 {{spaceRentTotal}}원, 보증금 {{deposit}}원, 합계 {{totalAmount}}원"))
                .isEqualTo("사용료 6,300,000원, 보증금 630,000원, 합계 7,350,000원");
    }

    @Test
    @DisplayName("같은 변수가 여러 번 → 모두 치환된다")
    void bind_substitutesEveryOccurrence() {
        assertThat(bindBody("{{days}}일, 다시 {{days}}일")).isEqualTo("14일, 다시 14일");
    }

    @Test
    @DisplayName("모르는 변수가 남음 → 조용히 통과시키지 않고 실패한다")
    void bind_unknownPlaceholder_fails() {
        assertThatThrownBy(() -> bindBody("서명자 {{signerName}}"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("signerName");
    }

    @Test
    @DisplayName("실제 v1 템플릿 바인딩 → 미치환 변수가 하나도 남지 않는다")
    void bind_realTemplate_leavesNoPlaceholder() {
        List<ClauseDto> bound = ClauseBinder.bind(ContractTemplate.v1().clauses(), BINDING);

        assertThat(bound).allSatisfy(clause -> {
            assertThat(clause.title()).doesNotContain("{{");
            assertThat(clause.body()).doesNotContain("{{");
        });
    }

    @Test
    @DisplayName("실제 v1 템플릿 바인딩 → 사용 기간이 조항 전문에 박힌다")
    void bind_realTemplate_statesActualPeriod() {
        String bodies = ClauseBinder.bind(ContractTemplate.v1().clauses(), BINDING).stream()
                .map(ClauseDto::body)
                .reduce("", (a, b) -> a + "\n" + b);

        assertThat(bodies).contains("2026-09-01").contains("2026-09-14").contains("14일");
    }
}
