package com.popupready.server.contract;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;

/**
 * 버전이 붙은 표준 계약 템플릿(US-202). 원본은 클래스패스 리소스
 * {@code contract/template-{version}.json}이고, 여기서는 읽어서 들고 있기만 한다.
 *
 * <p><b>법률 세이프가드가 걸린 자산이다.</b> 계약 명칭 "단기 공간사용 제휴계약"과 필수 조항
 * (일시사용 목적·계약갱신요구권 불행사·보증금 하향·구조 변경 금지)은 상가건물 임대차보호법상
 * 일시사용 임대차 인정 요건을 계약서에 명문화하기 위한 것이다. 문구를 임의로 바꾸지 말 것 —
 * 변경은 PM 협의 사항이며, {@code ContractTemplateTest}가 필수 문구의 존재를 지키고 있다.
 *
 * <p>템플릿이 바뀌면 <b>버전을 올려 새 파일을 추가</b>한다. 이미 만들어진 계약은 생성 시점의 전문을
 * 스냅샷으로 들고 있으므로 소급해서 바뀌지 않지만, 어느 버전으로 만들어졌는지는 남아야 한다.
 */
public record ContractTemplate(String version, String title, List<ClauseTemplate> clauses) {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** 현재 쓰는 버전. 새 버전을 추가하면 여기를 올린다. */
    public static final String CURRENT_VERSION = "v1";

    /**
     * 계약 명칭. <b>임의 변경 금지</b> — '임대차계약'이 되는 순간 일시사용 요건 논의가 아니라
     * 통상 임대차로 읽힌다(백로그 품질 게이트).
     */
    public static final String TITLE = "단기 공간사용 제휴계약";

    private static final java.util.regex.Pattern PLACEHOLDER = java.util.regex.Pattern.compile("\\{\\{(\\w+)}}");

    // 리소스를 매번 읽지 않는다. 불변이므로 공유해도 안전하다.
    private static final Map<String, ContractTemplate> CACHE = new java.util.concurrent.ConcurrentHashMap<>();

    public ContractTemplate {
        clauses = List.copyOf(clauses);
    }

    public static ContractTemplate v1() {
        return of(CURRENT_VERSION);
    }

    public static ContractTemplate of(String version) {
        return CACHE.computeIfAbsent(version, ContractTemplate::load);
    }

    private static ContractTemplate load(String version) {
        String path = "contract/template-%s.json".formatted(version);
        try (InputStream in = ContractTemplate.class.getClassLoader().getResourceAsStream(path)) {
            if (in == null) {
                throw new IllegalArgumentException("계약 템플릿을 찾을 수 없습니다: " + path);
            }
            return MAPPER.readValue(in, ContractTemplate.class);
        } catch (IOException e) {
            // 템플릿을 못 읽으면 계약을 만들 수 없다. 조용히 빈 계약서를 내보내는 것보다 죽는 편이 낫다.
            throw new IllegalStateException("계약 템플릿을 읽을 수 없습니다: " + path, e);
        }
    }

    /** 이 템플릿이 실제로 쓰는 변수 이름들. 리소스의 오타를 테스트가 잡을 수 있게 한다. */
    public Set<String> placeholders() {
        Set<String> names = new HashSet<>();
        for (ClauseTemplate clause : clauses) {
            collect(clause.title(), names);
            collect(clause.body(), names);
        }
        return names;
    }

    private static void collect(String text, Set<String> names) {
        Matcher matcher = PLACEHOLDER.matcher(text);
        while (matcher.find()) {
            names.add(matcher.group(1));
        }
    }
}
