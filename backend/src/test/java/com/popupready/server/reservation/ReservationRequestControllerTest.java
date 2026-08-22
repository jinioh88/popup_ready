package com.popupready.server.reservation;

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

@WebMvcTest(ReservationRequestController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
class ReservationRequestControllerTest {

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

    @Test
    @DisplayName("정상 예약 요청 → 201과 생성된 요청 반환")
    void create_validRequest_returnsCreated() throws Exception {
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
        mockMvc.perform(post("/api/v1/reservation-requests")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(jsonPath("$.data.estimate.days").isNumber())
                .andExpect(jsonPath("$.data.estimate.spaceRentTotal").isNumber())
                .andExpect(jsonPath("$.data.estimate.fixtureRentalTotal").isNumber())
                .andExpect(jsonPath("$.data.estimate.deposit").isNumber())
                .andExpect(jsonPath("$.data.estimate.totalAmount").isNumber());
    }

    @Test
    @DisplayName("정상 예약 요청 → 보낸 레이아웃이 그대로 되돌아온다")
    void create_validRequest_echoesLayout() throws Exception {
        mockMvc.perform(post("/api/v1/reservation-requests")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_BODY))
                .andExpect(jsonPath("$.data.layout.gridCols").value(20))
                .andExpect(jsonPath("$.data.layout.items[0].fixtureId").value(3))
                .andExpect(jsonPath("$.data.layout.items[0].rotation").value(90));
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
