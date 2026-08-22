package com.popupready.server.auth;

import com.popupready.server.common.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
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
 * ⚠️ Phase 0 계약 스텁 — 고정 샘플을 돌려준다.
 *
 * <p>여기서 확정한 경로·필드명·상태 코드가 contracts/openapi.json이 되고, 웹·모바일은 그 파일로
 * 타입을 생성한다. <b>실구현(T2-3)에서 속만 채우고 스펙은 바꾸지 않는다</b> — 바꿔야 한다면
 * 스프린트 문서 §2.2 갱신과 PM 보고가 선행이다.
 */
@RestController
@RequestMapping(value = "/api/v1/auth", produces = MediaType.APPLICATION_JSON_VALUE)
@Tag(name = "auth", description = "가입·로그인")
public class AuthController {

    /** TODO(T2-3): jjwt로 발급한 실제 토큰으로 교체. 스텁임을 값에서 바로 알 수 있게 둔다. */
    private static final String STUB_ACCESS_TOKEN = "stub-access-token";

    private static final Long STUB_USER_ID = 1L;

    @Operation(summary = "가입", description = "이메일·비밀번호로 가입하고 즉시 Access 토큰을 받는다.")
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AuthResponse> signup(@Valid @RequestBody SignupRequest request) {
        UserSummary user = new UserSummary(STUB_USER_ID, request.email(), request.name(), request.role());
        return ApiResponse.ok(new AuthResponse(STUB_ACCESS_TOKEN, user));
    }

    @Operation(summary = "로그인", description = "이메일·비밀번호를 검증하고 Access 토큰을 받는다.")
    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        UserSummary user = new UserSummary(STUB_USER_ID, request.email(), "김브랜드", UserRole.BRAND);
        return ApiResponse.ok(new AuthResponse(STUB_ACCESS_TOKEN, user));
    }
}
