package com.popupready.server.common;

import java.util.Set;

/**
 * 인증 없이 접근할 수 있는 경로의 <b>단일 진실</b>.
 *
 * <p>같은 목록이 Security 설정과 OpenAPI 문서 두 곳에 필요한데, 따로 적어두면 한쪽만 고쳐져
 * 문서와 실제 동작이 갈라진다. 그래서 여기 모아두고 양쪽이 참조한다.
 *
 * <p>표현이 두 가지인 것은 매칭 방식이 다르기 때문이다 — Security는 Ant 패턴({@code /spaces/*}),
 * OpenAPI는 경로 템플릿({@code /spaces/{id}})을 쓴다. 나란히 두어 한쪽만 바뀌면 눈에 띄게 했고,
 * {@code SecurityAccessTest}와 {@code OpenApiContractTest}가 양쪽을 각각 못 박는다.
 */
public final class PublicEndpoints {

    private PublicEndpoints() {}

    /** 인증을 얻는 경로라 인증을 요구할 수 없다. */
    public static final String AUTH_ANT = "/api/v1/auth/**";

    private static final String AUTH_PREFIX = "/api/v1/auth/";

    /** 탐색은 로그인 전에 일어난다(US-101). 조회만 열고 쓰기는 열지 않는다. */
    public static final String[] DISCOVERY_GET_ANT = {"/api/v1/spaces", "/api/v1/spaces/*", "/api/v1/fixtures"};

    private static final Set<String> DISCOVERY_GET_TEMPLATES =
            Set.of("/api/v1/spaces", "/api/v1/spaces/{id}", "/api/v1/fixtures");

    public static final String[] DOCS_ANT = {"/v3/api-docs", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html"};

    /** OpenAPI 경로 템플릿 기준 공개 여부. 문서에 401·인증 요구를 붙일지 정하는 데 쓴다. */
    public static boolean isPublic(String pathTemplate, String httpMethod) {
        if (pathTemplate.startsWith(AUTH_PREFIX)) {
            return true;
        }
        return "GET".equalsIgnoreCase(httpMethod) && DISCOVERY_GET_TEMPLATES.contains(pathTemplate);
    }
}
