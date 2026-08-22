package com.popupready.server.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** 가입 요청. 소셜 로그인·본인인증은 MVP 범위 밖이라 이메일·비밀번호만 받는다. */
@Schema(description = "가입 요청")
public record SignupRequest(
        @Schema(description = "이메일(로그인 ID)", example = "brand@popupready.com")
                @NotBlank(message = "이메일은 필수입니다")
                @Email(message = "이메일 형식이 아닙니다")
                String email,
        @Schema(description = "비밀번호(8자 이상)", example = "password123")
                @NotBlank(message = "비밀번호는 필수입니다")
                @Size(min = 8, max = 64, message = "비밀번호는 8자 이상 64자 이하여야 합니다")
                String password,
        @Schema(description = "표시 이름", example = "김브랜드") @NotBlank(message = "이름은 필수입니다") String name,
        @Schema(description = "역할") @NotNull(message = "역할은 필수입니다") UserRole role) {}
