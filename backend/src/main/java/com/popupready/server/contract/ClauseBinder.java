package com.popupready.server.contract;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 템플릿 조항에 예약 데이터를 꽂아 전문 스냅샷을 만든다(US-202).
 *
 * <p>의존성이 없는 순수 함수다. 계약서는 분쟁 시 소명 자료가 되므로 <b>미치환 변수를 통과시키지
 * 않는다</b> — 전문에 {@code {{brandName}}}이 그대로 남은 계약서는 결함이고, 조용히 넘어가면
 * 양측 서명이 끝난 뒤에야 발견된다.
 */
public final class ClauseBinder {

    private ClauseBinder() {}

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{(\\w+)}}");

    public static List<ClauseDto> bind(List<ClauseTemplate> clauses, ContractBinding binding) {
        Map<String, String> values = binding.values();
        return clauses.stream()
                .map(clause -> new ClauseDto(substitute(clause.title(), values), substitute(clause.body(), values)))
                .toList();
    }

    private static String substitute(String text, Map<String, String> values) {
        Matcher matcher = PLACEHOLDER.matcher(text);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            String name = matcher.group(1);
            String value = values.get(name);
            if (value == null) {
                throw new IllegalStateException("계약 템플릿이 알 수 없는 변수를 씁니다: " + name);
            }
            matcher.appendReplacement(out, Matcher.quoteReplacement(value));
        }
        matcher.appendTail(out);
        return out.toString();
    }
}
