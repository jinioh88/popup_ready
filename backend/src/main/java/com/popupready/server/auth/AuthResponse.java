package com.popupready.server.auth;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 가입·로그인 공통 응답. Refresh 토큰은 Sprint 2 범위이므로 Access 토큰만 내려간다
 * (스프린트 문서 §2.2).
 */
@Schema(description = "인증 결과")
public record AuthResponse(
        @Schema(description = "JWT Access 토큰. 이후 요청에 Bearer로 싣는다") String accessToken,
        @Schema(description = "인증된 사용자 정보") UserSummary user) {}
