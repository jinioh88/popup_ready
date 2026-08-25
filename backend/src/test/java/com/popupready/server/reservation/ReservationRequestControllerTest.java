package com.popupready.server.reservation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.popupready.server.auth.JwtPrincipal;
import com.popupready.server.auth.JwtProvider;
import com.popupready.server.auth.UserRole;
import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import com.popupready.server.common.GlobalExceptionHandler;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ReservationRequestController.class)
// 보안 필터는 끈다. 이 슬라이스가 볼 것은 입력 검증·응답 봉투이고,
// 어느 경로가 열리고 닫히는지는 SecurityAccessTest가 못 박는다.
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class ReservationRequestControllerTest {

    private static final long TOKEN_USER_ID = 7L;

    private static final String VALID_BODY =
            """
            {
              "spaceId": 1,
              "startDate": "2026-09-01",
              "endDate": "2026-09-14",
              "layout": {
                "gridCols": 20,
                "gridRows": 12,
                "cellSizeMm": 500,
                "items": [
                  { "fixtureId": 3, "col": 4, "row": 2, "rotation": 90 }
                ]
              }
            }
            """;

    @Autowired
    private MockMvc mockMvc;

    // @WebMvcTest는 Filter 타입 빈을 슬라이스에 포함해 JwtAuthenticationFilter가 딸려 온다.
    // 필터는 addFilters=false로 이미 무력화됐고, 여기서는 그 의존만 채워 컨텍스트를 띄운다.
    @MockitoBean
    private JwtProvider jwtProvider;

    @MockitoBean
    private ReservationRequestService reservationRequestService;

    /**
     * 필터를 껐으므로 SecurityContext를 채우는 필터도 돌지 않는다. {@code @AuthenticationPrincipal}은
     * SecurityContextHolder를 직접 읽으므로 여기에 신원을 심어 준다 — 안 심으면 principal이 null이라
     * 입력 검증이 아니라 NPE를 보게 된다.
     */
    @BeforeEach
    void authenticateAsBrand() {
        SecurityContextHolder.getContext()
                .setAuthentication(new UsernamePasswordAuthenticationToken(
                        new JwtPrincipal(TOKEN_USER_ID, UserRole.BRAND), null, List.of()));
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private static ReservationRequestResponse sampleResponse() {
        LayoutDto layout = new LayoutDto(20, 12, 500, List.of(new LayoutItemDto(3L, 4, 2, 90)));
        return new ReservationRequestResponse(
                1L,
                1L,
                TOKEN_USER_ID,
                LocalDate.of(2026, 9, 1),
                LocalDate.of(2026, 9, 14),
                layout,
                new EstimateResponse(14, 6_300_000L, 420_000L, 630_000L, 7_350_000L),
                ReservationStatus.DRAFT);
    }

    @Test
    @DisplayName("정상 예약 요청 → 201과 생성된 요청 반환")
    void create_validRequest_returnsCreated() throws Exception {
        given(reservationRequestService.create(eq(TOKEN_USER_ID), any())).willReturn(sampleResponse());

        mockMvc.perform(post("/api/v1/reservation-requests")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.status").isNotEmpty())
                .andExpect(jsonPath("$.error").doesNotExist());
    }

    @Test
    @DisplayName("정상 예약 요청 → 응답에 견적 breakdown이 담긴다")
    void create_validRequest_returnsEstimateBreakdown() throws Exception {
        given(reservationRequestService.create(eq(TOKEN_USER_ID), any())).willReturn(sampleResponse());

        mockMvc.perform(post("/api/v1/reservation-requests")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(jsonPath("$.data.estimate.days").value(14))
                .andExpect(jsonPath("$.data.estimate.spaceRentTotal").value(6_300_000L))
                .andExpect(jsonPath("$.data.estimate.fixtureRentalTotal").value(420_000L))
                .andExpect(jsonPath("$.data.estimate.deposit").value(630_000L))
                .andExpect(jsonPath("$.data.estimate.totalAmount").value(7_350_000L));
    }

    @Test
    @DisplayName("정상 예약 요청 → 서버가 재검증한 레이아웃이 응답에 담긴다")
    void create_validRequest_echoesLayout() throws Exception {
        given(reservationRequestService.create(eq(TOKEN_USER_ID), any())).willReturn(sampleResponse());

        mockMvc.perform(post("/api/v1/reservation-requests")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(jsonPath("$.data.layout.gridCols").value(20))
                .andExpect(jsonPath("$.data.layout.items[0].fixtureId").value(3))
                .andExpect(jsonPath("$.data.layout.items[0].rotation").value(90));
    }

    @Test
    @DisplayName("브랜드 사용자 ID는 본문이 아니라 토큰에서 온다")
    void create_takesBrandUserIdFromToken() throws Exception {
        given(reservationRequestService.create(eq(TOKEN_USER_ID), any())).willReturn(sampleResponse());

        mockMvc.perform(post("/api/v1/reservation-requests")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isCreated());

        verify(reservationRequestService).create(eq(TOKEN_USER_ID), any());
    }

    @Test
    @DisplayName("도메인 규칙 위반(겹침) → 400과 LAYOUT_OVERLAP 에러 봉투")
    void create_domainRuleViolation_returnsErrorEnvelope() throws Exception {
        willThrow(new ApiException(ErrorCode.LAYOUT_OVERLAP, "집기의 점유 영역이 겹칩니다"))
                .given(reservationRequestService)
                .create(eq(TOKEN_USER_ID), any());

        mockMvc.perform(post("/api/v1/reservation-requests")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(jsonPath("$.error.code").value("LAYOUT_OVERLAP"));
    }

    @Test
    @DisplayName("이미 결제된 기간과 겹침 → 409와 SPACE_ALREADY_BOOKED 에러 봉투")
    void create_overlappingPaidPeriod_returnsConflict() throws Exception {
        // 웹은 이 코드로 "이미 예약된 기간입니다 / 다른 날짜를 선택해 주세요"를 띄운다.
        // 결제 승인이 내는 것과 같은 코드다 — 두 시점이 같은 문구를 쓰게 하려는 것이다.
        willThrow(new ApiException(ErrorCode.SPACE_ALREADY_BOOKED, "이미 예약된 기간입니다"))
                .given(reservationRequestService)
                .create(eq(TOKEN_USER_ID), any());

        mockMvc.perform(post("/api/v1/reservation-requests")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(jsonPath("$.error.code").value("SPACE_ALREADY_BOOKED"));
    }

    @Test
    @DisplayName("layout 누락 → 400과 VALIDATION_FAILED 에러 봉투")
    void create_missingLayout_returnsBadRequestWithErrorEnvelope() throws Exception {
        String body =
                """
                {
                  "spaceId": 1,
                  "startDate": "2026-09-01",
                  "endDate": "2026-09-14"
                }
                """;

        mockMvc.perform(post("/api/v1/reservation-requests")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
        verify(reservationRequestService, never()).create(org.mockito.ArgumentMatchers.anyLong(), any());
    }

    @Test
    @DisplayName("ISO 형식이 아닌 날짜 → 400과 VALIDATION_FAILED 에러 봉투")
    void create_malformedDate_returnsBadRequestWithErrorEnvelope() throws Exception {
        String body =
                """
                {
                  "spaceId": 1,
                  "startDate": "2026년 9월 1일",
                  "endDate": "2026-09-14",
                  "layout": { "gridCols": 20, "gridRows": 12, "cellSizeMm": 500, "items": [] }
                }
                """;

        mockMvc.perform(post("/api/v1/reservation-requests")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("레이아웃 항목의 col이 음수 → 400과 VALIDATION_FAILED 에러 봉투")
    void create_negativeCellCoordinate_returnsBadRequestWithErrorEnvelope() throws Exception {
        String body =
                """
                {
                  "spaceId": 1,
                  "startDate": "2026-09-01",
                  "endDate": "2026-09-14",
                  "layout": {
                    "gridCols": 20,
                    "gridRows": 12,
                    "cellSizeMm": 500,
                    "items": [ { "fixtureId": 3, "col": -1, "row": 2, "rotation": 0 } ]
                  }
                }
                """;

        mockMvc.perform(post("/api/v1/reservation-requests")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
    }
}
