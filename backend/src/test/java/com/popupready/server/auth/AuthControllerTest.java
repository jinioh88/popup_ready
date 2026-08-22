package com.popupready.server.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.popupready.server.common.GlobalExceptionHandler;
import com.popupready.server.common.SecurityConfig;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 계약 스텁 단계의 검증 대상은 <b>스펙</b>이다 — 경로·상태 코드·필드명·검증 실패 시 봉투 형태.
 * 요청 본문을 텍스트 블록으로 두는 것은 그 계약을 문서처럼 눈으로 확인하기 위함이다.
 */
@WebMvcTest(AuthController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("정상 가입 요청 → 201과 accessToken 반환")
    void signup_validRequest_returnsCreatedWithAccessToken() throws Exception {
        String body =
                """
                {
                  "email": "brand@popupready.com",
                  "password": "password123",
                  "name": "김브랜드",
                  "role": "BRAND"
                }
                """;

        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.error").doesNotExist());
    }

    @Test
    @DisplayName("정상 가입 요청 → 응답 user에 요청한 email·role이 담긴다")
    void signup_validRequest_echoesRequestedUserSummary() throws Exception {
        String body =
                """
                {
                  "email": "landlord@popupready.com",
                  "password": "password123",
                  "name": "박건물주",
                  "role": "LANDLORD"
                }
                """;

        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(jsonPath("$.data.user.email").value("landlord@popupready.com"))
                .andExpect(jsonPath("$.data.user.role").value("LANDLORD"));
    }

    @Test
    @DisplayName("email 누락 → 400과 VALIDATION_FAILED 에러 봉투")
    void signup_missingEmail_returnsBadRequestWithErrorEnvelope() throws Exception {
        String body =
                """
                {
                  "password": "password123",
                  "name": "김브랜드",
                  "role": "BRAND"
                }
                """;

        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("이메일 형식이 아닌 email → 400")
    void signup_malformedEmail_returnsBadRequest() throws Exception {
        String body =
                """
                {
                  "email": "not-an-email",
                  "password": "password123",
                  "name": "김브랜드",
                  "role": "BRAND"
                }
                """;

        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("정의되지 않은 role 값 → 400과 VALIDATION_FAILED 에러 봉투")
    void signup_unknownRole_returnsBadRequestWithErrorEnvelope() throws Exception {
        String body =
                """
                {
                  "email": "brand@popupready.com",
                  "password": "password123",
                  "name": "김브랜드",
                  "role": "GUEST"
                }
                """;

        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("정상 로그인 요청 → 200과 accessToken 반환")
    void login_validRequest_returnsOkWithAccessToken() throws Exception {
        String body =
                """
                {
                  "email": "brand@popupready.com",
                  "password": "password123"
                }
                """;

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.error").doesNotExist());
    }

    @Test
    @DisplayName("password 누락 → 400과 VALIDATION_FAILED 에러 봉투")
    void login_missingPassword_returnsBadRequestWithErrorEnvelope() throws Exception {
        String body =
                """
                {
                  "email": "brand@popupready.com"
                }
                """;

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("본문 없는 요청 → 400과 VALIDATION_FAILED 에러 봉투")
    void login_missingBody_returnsBadRequestWithErrorEnvelope() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
    }
}
