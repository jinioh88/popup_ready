package com.popupready.server.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.popupready.server.auth.JwtProvider;
import com.popupready.server.auth.UserRole;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 어느 경로가 열려 있고 어느 경로가 잠겨 있는지를 못 박는다. Phase 0의 임시 permitAll이
 * 되살아나거나 새 엔드포인트가 실수로 공개되는 것을 이 테스트가 막는다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SecurityAccessTest {

    private static final String VALID_BODY =
            """
            {
              "spaceId": 1,
              "startDate": "2026-09-01",
              "endDate": "2026-09-14",
              "layout": { "gridCols": 20, "gridRows": 12, "cellSizeMm": 500, "items": [] }
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtProvider jwtProvider;

    private String bearer(UserRole role) {
        return "Bearer " + jwtProvider.issue(1L, role);
    }

    @Test
    @DisplayName("로그인 → 인증 없이 열려 있다(자격 증명 실패로 갈 뿐 필터에 막히지 않는다)")
    void authEndpoints_arePublic() throws Exception {
        // 필터에 막혔다면 UNAUTHORIZED가, 통과해 자격 증명을 검증했다면 INVALID_CREDENTIALS가 나온다.
        // 둘 다 401이라 상태 코드만으로는 구분되지 않으므로 에러 코드로 확인한다.
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"nobody@popupready.com\",\"password\":\"password123\"}"))
                .andExpect(jsonPath("$.error.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    @DisplayName("공간 검색·집기 조회 → 인증 없이 열려 있다(탐색은 로그인 전에 일어난다)")
    void discoveryEndpoints_arePublic() throws Exception {
        mockMvc.perform(get("/api/v1/spaces").param("lat", "37.5445").param("lng", "127.0557"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/fixtures")).andExpect(status().isOk());
    }

    @Test
    @DisplayName("API 문서 경로 → 인증 없이 열려 있다")
    void apiDocs_isPublic() throws Exception {
        mockMvc.perform(get("/v3/api-docs")).andExpect(status().isOk());
    }

    @Test
    @DisplayName("토큰 없이 예약 요청 → 401과 UNAUTHORIZED 에러 봉투")
    void reservationRequest_withoutToken_returnsUnauthorizedEnvelope() throws Exception {
        mockMvc.perform(post("/api/v1/reservation-requests")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("토큰 없이 계약 열람 → 401")
    void contractRead_withoutToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/contracts/1")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("브랜드 토큰으로 예약 요청 → 인가에 막히지 않는다")
    void reservationRequest_withValidToken_isAllowed() throws Exception {
        // 이 테스트가 볼 것은 인가 통과 여부다. 본문이 지목한 공간이 실제로 있는지·도면이 맞는지는
        // 예약 도메인의 판정이고 ReservationRequestFlowTest가 본다. 여기서 201을 기대하면
        // 이 보안 테스트가 시드 데이터에 묶여 조용히 깨진다.
        mockMvc.perform(post("/api/v1/reservation-requests")
                        .header(HttpHeaders.AUTHORIZATION, bearer(UserRole.BRAND))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(result -> assertThat(result.getResponse().getStatus())
                        .as("인증·인가 단계에서 막히지 않아야 한다")
                        .isNotIn(401, 403));
    }

    @Test
    @DisplayName("브랜드가 아닌 역할로 예약 요청 → 403과 FORBIDDEN 에러 봉투")
    void reservationRequest_withNonBrandRole_isForbidden() throws Exception {
        // 예약을 만드는 것은 브랜드 운영자다. 인증만 통과하면 누구나 되는 상태로 두면
        // 건물주·공급사 계정으로도 예약이 생성된다.
        mockMvc.perform(post("/api/v1/reservation-requests")
                        .header(HttpHeaders.AUTHORIZATION, bearer(UserRole.VENDOR))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
    }

    @Test
    @DisplayName("건물주 역할로 계약 열람 → 역할로는 막히지 않는다(계약은 양 당사자가 본다)")
    void contractRead_withLandlordRole_isAllowed() throws Exception {
        // 계약 열람은 역할이 아니라 '당사자인가'로 갈린다. 여기서 볼 것은 Security 설정이 건물주
        // 역할을 통째로 막지 않는다는 것뿐이고, 당사자 판정은 ContractServiceTest가 본다.
        // 실제 열람 결과(존재하지 않는 계약이면 404)에 이 보안 테스트를 묶지 않는다.
        mockMvc.perform(get("/api/v1/contracts/1").header(HttpHeaders.AUTHORIZATION, bearer(UserRole.LANDLORD)))
                .andExpect(result -> assertThat(result.getResponse().getStatus())
                        .as("역할 때문에 막히면 안 된다")
                        .isNotIn(401, 403));
    }

    @Test
    @DisplayName("위조된 토큰 → 401과 UNAUTHORIZED 에러 봉투")
    void forgedToken_returnsUnauthorizedEnvelope() throws Exception {
        mockMvc.perform(get("/api/v1/contracts/1").header(HttpHeaders.AUTHORIZATION, "Bearer forged.token.value"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("Bearer 접두 없는 Authorization 헤더 → 인증되지 않은 것으로 본다")
    void nonBearerAuthorizationHeader_returnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/contracts/1").header(HttpHeaders.AUTHORIZATION, "Basic abcdef"))
                .andExpect(status().isUnauthorized());
    }

    // ── Sprint 2 신규 경로 (T0-8) ────────────────────────────────────────────
    // Sprint 1의 교훈: 인증 테스트가 업무 경로를 탐침으로 쓰면 스텁이 실물이 되는 순간 조용히
    // 깨진다(200이 404가 된다). 여기서 보는 것은 응답 본문이 아니라 "필터에 막히는가" 하나다.

    @Test
    @DisplayName("토큰 없이 결제 승인 → 401")
    void paymentConfirm_withoutToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(
                        post("/api/v1/reservation-requests/1/payment/confirm")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                {"paymentKey": "k", "orderId": "o", "amount": 1000}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("토큰 없이 정산 내역 조회 → 401")
    void settlements_withoutToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/settlements?reservationId=1")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("토큰 없이 도어 오픈 → 401")
    void doorOpen_withoutToken_returnsUnauthorized() throws Exception {
        mockMvc.perform(post("/api/v1/reservation-requests/1/door-open")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("토큰 없이 집기 가용성 조회 → 401 (탐색과 달리 공개가 아니다)")
    void fixtureAvailability_withoutToken_returnsUnauthorized() throws Exception {
        // 공간·집기 목록은 공개지만 가용 수량은 예약 밀도를 드러내므로 로그인 뒤에만 준다.
        mockMvc.perform(get("/api/v1/spaces/1/fixture-availability?startDate=2026-09-01&endDate=2026-09-14"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("refresh → 인증 없이 열려 있다(토큰을 얻는 경로다)")
    void refresh_isPublic() throws Exception {
        // 상태 코드만 보면 필터의 401과 핸들러의 401을 구분할 수 없다. 에러 코드로 가른다 —
        // REFRESH_TOKEN_INVALID가 왔다는 것은 요청이 필터를 지나 핸들러까지 갔다는 뜻이다.
        // (Sprint 1 교훈: 인증 테스트가 업무 결과를 탐침으로 쓰면 구현이 바뀔 때 조용히 깨진다.)
        mockMvc.perform(
                        post("/api/v1/auth/refresh")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        """
                                {"refreshToken": "never-issued"}
                                """))
                .andExpect(jsonPath("$.error.code").value("REFRESH_TOKEN_INVALID"));
    }
}
