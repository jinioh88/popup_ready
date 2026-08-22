package com.popupready.server.auth;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/** 인증 응답에 실리는 사용자 요약. 비밀번호 해시 등 민감 필드는 절대 포함하지 않는다. */
@Schema(description = "로그인한 사용자 요약")
public record UserSummary(
        @Schema(description = "사용자 ID", example = "1", requiredMode = REQUIRED) Long id,
        @Schema(description = "이메일(로그인 ID)", example = "brand@popupready.com", requiredMode = REQUIRED) String email,
        @Schema(description = "표시 이름", example = "김브랜드", requiredMode = REQUIRED) String name,
        @Schema(description = "역할", requiredMode = REQUIRED) UserRole role) {}
