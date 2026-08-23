package com.popupready.server.door;

import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.popupready.server.auth.JwtPrincipal;
import com.popupready.server.auth.JwtProvider;
import com.popupready.server.auth.UserRole;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 도어 API의 HTTP 계약. <b>이 슬라이스가 없어서 배선 누락이 한 번 숨었다</b> —
 * {@link DoorServiceTest}는 서비스를 직접 부르므로 컨트롤러가 스텁 응답을 그대로 돌려주고 있어도
 * 전부 초록이었고, 실서버에 붙여보고서야 드러났다. 여기서 보는 것은 <b>컨트롤러가 서비스를
 * 실제로 부르는가</b>다.
 */
@WebMvcTest(DoorController.class)
@AutoConfigureMockMvc(addFilters = false)
class DoorControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private JwtProvider jwtProvider;

    @MockitoBean
    private DoorService doorService;

    /**
     * 필터를 껐으므로 SecurityContext를 채우는 필터도 돌지 않는다. {@code @AuthenticationPrincipal}은
     * SecurityContextHolder를 직접 읽으므로 여기에 신원을 심어 준다 — 안 심으면 principal이 null이라
     * 계약이 아니라 NPE를 보게 된다.
     */
    @BeforeEach
    void authenticateAsBrand() {
        SecurityContextHolder.getContext()
                .setAuthentication(
                        new UsernamePasswordAuthenticationToken(new JwtPrincipal(7L, UserRole.BRAND), null, List.of()));
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("도어 개방 요청 → 서비스에 위임하고 201로 응답한다")
    void open_delegatesToService() {
        given(doorService.open(anyLong(), anyLong()))
                .willReturn(new DoorOpenResponse(
                        7L,
                        "popupready/locks/1/command",
                        "popupready/locks/1/status",
                        new DoorCommandPayload(7L, 45L, "OPEN", Instant.parse("2026-09-01T00:50:00Z")),
                        DoorEventStatus.AUTHORIZED));

        org.assertj.core.api.Assertions.assertThatCode(
                        () -> mockMvc.perform(post("/api/v1/reservation-requests/45/door-open"))
                                .andExpect(status().isCreated())
                                // 스텁이 돌려주던 고정값 123이 아니라 서비스가 준 값이어야 한다.
                                .andExpect(jsonPath("$.data.eventId").value(7))
                                .andExpect(jsonPath("$.data.statusTopic").value("popupready/locks/1/status")))
                .doesNotThrowAnyException();

        verify(doorService).open(anyLong(), anyLong());
    }

    @Test
    @DisplayName("ack 요청 → 성공 여부를 그대로 서비스에 넘긴다")
    void ack_delegatesSuccessFlag() {
        given(doorService.ack(anyLong(), anyLong(), anyBoolean()))
                .willReturn(new DoorAckResponse(7L, DoorEventStatus.FAILED, Instant.parse("2026-09-01T00:50:02Z")));

        org.assertj.core.api.Assertions.assertThatCode(() -> mockMvc.perform(
                                post("/api/v1/door-events/7/ack")
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                """
                                        {"success": false}
                                        """))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.data.status").value("FAILED")))
                .doesNotThrowAnyException();

        verify(doorService).ack(anyLong(), anyLong(), org.mockito.ArgumentMatchers.eq(false));
    }

    @Test
    @DisplayName("success 누락 → 400")
    void ack_missingSuccess_returnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/v1/door-events/7/ack")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }
}
