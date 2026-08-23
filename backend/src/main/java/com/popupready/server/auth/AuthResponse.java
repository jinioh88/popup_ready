package com.popupready.server.auth;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 가입·로그인 공통 응답(스프린트 문서 §2.2-B).
 *
 * <p>Sprint 2에서 {@code refreshToken}이 추가됐다. refresh 회전을 도입하면 로그인 시점에 첫
 * refresh 토큰을 함께 내려야 하므로 필연적인 변경이며, 웹·모바일 생성 타입에 그대로 드러난다.
 */
@Schema(description = "인증 결과")
public record AuthResponse(
        @Schema(description = "JWT Access 토큰. 이후 요청에 Bearer로 싣는다", requiredMode = REQUIRED) String accessToken,
        @Schema(description = "Refresh 토큰. 만료 시 /auth/refresh로 재발급받는다", requiredMode = REQUIRED) String refreshToken,
        @Schema(description = "인증된 사용자 정보", requiredMode = REQUIRED) UserSummary user) {}
