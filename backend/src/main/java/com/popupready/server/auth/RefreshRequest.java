package com.popupready.server.auth;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * 토큰 재발급 요청. 형식 검증만 하고 유효성 판정은 서버가 한다.
 *
 * <p>만료·위조·재사용을 구분해 알려주지 않고 전부 {@code REFRESH_TOKEN_INVALID}로 같게 처리한다 —
 * 사유가 구분되면 공격자에게 단서가 된다({@link JwtProvider#parse}와 같은 이유).
 */
@Schema(description = "토큰 재발급 요청")
public record RefreshRequest(
        @Schema(description = "발급받은 Refresh 토큰") @NotBlank(message = "refreshToken은 필수입니다") String refreshToken) {}
