package com.popupready.server.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/** 로그인 요청. 형식 검증만 하고 자격 증명 판정은 서버가 한다(실패 시 INVALID_CREDENTIALS). */
@Schema(description = "로그인 요청")
public record LoginRequest(
        @Schema(description = "이메일(로그인 ID)", example = "brand@popupready.com") @NotBlank(message = "이메일은 필수입니다")
                String email,
        @Schema(description = "비밀번호", example = "password123") @NotBlank(message = "비밀번호는 필수입니다") String password) {}
