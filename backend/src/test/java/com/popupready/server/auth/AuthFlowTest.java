package com.popupready.server.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/**
 * 가입 → 로그인 → 보호 API 호출이 실제로 이어지는지 확인한다.
 *
 * <p>조각별 테스트가 모두 통과해도 이 경로가 끊겨 있을 수 있다 — T2-2까지는 login이 스텁 토큰을
 * 돌려줘서 실제로 끊겨 있었고, 단위 테스트는 토큰을 직접 발급해 그 사실을 가리고 있었다.
 * 웹·모바일이 실 API로 전환하는 순간 처음 밟는 경로이므로 여기서 한 번에 확인한다.
 *
 * <p>{@code @Transactional}로 테스트 계정이 DB에 남지 않게 한다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class AuthFlowTest {

    private static final String SIGNUP_BODY =
            """
            {
              "email": "flow@popupready.com",
              "password": "password123",
              "name": "김브랜드",
              "role": "BRAND"
            }
            """;

    private static final String LOGIN_BODY =
            """
            {
              "email": "flow@popupready.com",
              "password": "password123"
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    private String signupAndGetToken() throws Exception {
        String body = mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SIGNUP_BODY))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$.data.accessToken");
    }

    /**
     * 이 테스트가 볼 것은 <b>토큰이 인증 필터를 통과하는가</b>다. 그래서 보호 경로의 업무 결과
     * (계약이 실제로 있는지)가 아니라 401이 아닌 것만 확인한다 — 여기서 200을 기대하면 인증
     * 테스트가 계약 도메인의 데이터에 묶여 조용히 깨진다(T5-3에서 실제로 그렇게 됐다).
     */
    private void assertPassesAuthentication(String token) throws Exception {
        mockMvc.perform(get("/api/v1/contracts/1").header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(result -> assertThat(result.getResponse().getStatus())
                        .as("인증 필터에 막히지 않아야 한다")
                        .isNotEqualTo(401));
    }

    @Test
    @DisplayName("가입 → 발급된 토큰으로 보호 API 호출이 통과한다")
    void signup_thenAccessProtectedApi() throws Exception {
        String token = signupAndGetToken();

        assertPassesAuthentication(token);
    }

    @Test
    @DisplayName("가입한 계정으로 로그인 → 같은 사용자 정보와 새 토큰을 받는다")
    void login_afterSignup_returnsSameUser() throws Exception {
        signupAndGetToken();

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LOGIN_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.data.user.email").value("flow@popupready.com"))
                .andExpect(jsonPath("$.data.user.role").value("BRAND"));
    }

    @Test
    @DisplayName("로그인으로 받은 토큰 → 보호 API 호출이 통과한다")
    void login_thenAccessProtectedApi() throws Exception {
        signupAndGetToken();

        String body = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(LOGIN_BODY))
                .andReturn()
                .getResponse()
                .getContentAsString();
        String token = JsonPath.read(body, "$.data.accessToken");

        assertPassesAuthentication(token);
    }

    @Test
    @DisplayName("같은 이메일로 두 번 가입 → 409와 EMAIL_ALREADY_EXISTS")
    void signup_twiceWithSameEmail_returnsConflict() throws Exception {
        signupAndGetToken();

        mockMvc.perform(post("/api/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(SIGNUP_BODY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("EMAIL_ALREADY_EXISTS"));
    }

    @Test
    @DisplayName("비밀번호가 틀린 로그인 → 401과 INVALID_CREDENTIALS")
    void login_withWrongPassword_returnsUnauthorized() throws Exception {
        signupAndGetToken();

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"flow@popupready.com\",\"password\":\"wrong-password\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("INVALID_CREDENTIALS"));
    }
}
