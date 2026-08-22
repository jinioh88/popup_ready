package com.popupready.server.auth;

import com.popupready.server.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 가입·로그인(T2-3 실구현).
 *
 * <p>Phase 0에서 확정한 경로·필드명·상태 코드를 그대로 유지한 채 속만 채웠다 — 스펙은 바뀌지
 * 않았으므로 재생성 diff도 없다.
 */
@RestController
@RequestMapping(value = "/api/v1/auth", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "auth", description = "가입·로그인")
public class AuthController {

    private static final String ERROR_ENVELOPE_REF = "#/components/schemas/ApiErrorResponse";

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @Operation(summary = "가입", description = "이메일·비밀번호로 가입하고 즉시 Access 토큰을 받는다.")
    // 공개 경로라 인증 401은 붙지 않지만, 이 오퍼레이션이 실제로 내보내는 실패는 문서에 있어야 한다.
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "409",
            description = "이미 사용 중인 이메일 (EMAIL_ALREADY_EXISTS)",
            content = @Content(schema = @Schema(ref = ERROR_ENVELOPE_REF)))
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AuthResponse> signup(@Valid @RequestBody SignupRequest request) {
        return ApiResponse.ok(authService.signup(request));
    }

    @Operation(summary = "로그인", description = "이메일·비밀번호를 검증하고 Access 토큰을 받는다.")
    // ⚠️ 메서드에 @ApiResponse를 하나라도 선언하면 springdoc이 자동 생성하던 성공 응답을 덮는다.
    //    성공 응답도 함께 적어야 계약에서 200이 사라지지 않는다(실제로 사라져서 발견했다).
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200",
            description = "로그인 성공",
            content = @Content(schema = @Schema(ref = "#/components/schemas/ApiResponseAuthResponse")))
    @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "401",
            description = "이메일 또는 비밀번호 불일치 (INVALID_CREDENTIALS)",
            content = @Content(schema = @Schema(ref = ERROR_ENVELOPE_REF)))
    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok(authService.login(request));
    }
}
