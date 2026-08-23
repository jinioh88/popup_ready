package com.popupready.server.common;

import com.popupready.server.auth.UserRole;
import java.util.List;
import org.springframework.http.HttpMethod;

/**
 * 인증만으로는 부족한 — <b>403이 날 수 있는</b> 경로의 단일 진실.
 *
 * <p>{@link PublicEndpoints}가 "인증이 필요한가"를 담당한다면 여기는 "누구에게 열려 있는가"를
 * 담당한다. 같은 목록이 Security 설정과 OpenAPI 문서 두 곳에 필요한데, 따로 적어두면 한쪽만
 * 고쳐져 문서와 실제 동작이 갈라진다(Phase 0·T2-2 리뷰 이월분).
 *
 * <p>제한의 근거는 두 가지이며 성격이 다르다:
 *
 * <ul>
 *   <li><b>역할</b> — Security 필터가 막는다. 예: 예약 생성은 브랜드만.
 *   <li><b>당사자</b> — 역할로는 못 가른다(브랜드도 건물주도 계약을 본다). 서비스가 막으며,
 *       Security는 인증까지만 본다. 그래도 <b>403이 나는 경로라는 사실은 문서화해야 한다.</b>
 * </ul>
 */
public final class RestrictedEndpoints {

    private RestrictedEndpoints() {}

    /** 역할로 갈리는 경로. Security 설정이 이 목록으로 규칙을 건다. */
    public record RoleRule(HttpMethod method, String antPattern, String pathTemplate, UserRole role) {}

    public static final List<RoleRule> ROLE_RULES = List.of(new RoleRule(
            HttpMethod.POST, "/api/v1/reservation-requests", "/api/v1/reservation-requests", UserRole.BRAND));

    /**
     * 당사자 여부로 갈리는 경로(OpenAPI 문서화 전용). Security는 인증까지만 보고 실제 판정은
     * {@code ContractService}가 한다 — 계약은 브랜드와 건물주 <b>양쪽</b>이 접근하므로 역할로
     * 가를 수 없기 때문이다.
     */
    private static final List<String> PARTY_ONLY_TEMPLATES = List.of(
            "/api/v1/contracts/{id}",
            "/api/v1/contracts/{id}/sign",
            "/api/v1/reservation-requests/{id}/contract",
            // Sprint 2 — 예약 단건 조회도 브랜드와 건물주 양쪽이 보므로 역할로 가를 수 없다.
            "/api/v1/reservation-requests/{id}");

    /** 이 오퍼레이션이 403을 낼 수 있는가. OpenAPI 문서가 이 판정으로 403을 붙인다. */
    public static boolean canReturnForbidden(String pathTemplate, String httpMethod) {
        boolean roleRestricted = ROLE_RULES.stream()
                .anyMatch(rule -> rule.pathTemplate().equals(pathTemplate)
                        && rule.method().name().equalsIgnoreCase(httpMethod));
        return roleRestricted || PARTY_ONLY_TEMPLATES.contains(pathTemplate);
    }
}
