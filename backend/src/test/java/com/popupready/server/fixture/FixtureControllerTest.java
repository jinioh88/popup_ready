package com.popupready.server.fixture;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.popupready.server.common.GlobalExceptionHandler;
import com.popupready.server.common.SecurityConfig;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(FixtureController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
class FixtureControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("category 없이 조회 → 200과 전체 집기 배열")
    void list_withoutCategory_returnsAllFixtures() throws Exception {
        mockMvc.perform(get("/api/v1/fixtures"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].id").isNumber())
                .andExpect(jsonPath("$.error").doesNotExist());
    }

    @Test
    @DisplayName("정의된 category로 조회 → 200")
    void list_withDefinedCategory_returnsOk() throws Exception {
        mockMvc.perform(get("/api/v1/fixtures").param("category", "HANGER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("정의되지 않은 category → 400과 VALIDATION_FAILED 에러 봉투")
    void list_withUnknownCategory_returnsBadRequestWithErrorEnvelope() throws Exception {
        mockMvc.perform(get("/api/v1/fixtures").param("category", "SOFA"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("집기 응답 → 빌더 배치·전력 합산에 필요한 규격 필드 포함")
    void list_returnsDimensionAndPowerFields() throws Exception {
        mockMvc.perform(get("/api/v1/fixtures"))
                .andExpect(jsonPath("$.data[0].widthMm").isNumber())
                .andExpect(jsonPath("$.data[0].depthMm").isNumber())
                .andExpect(jsonPath("$.data[0].powerWatt").isNumber())
                .andExpect(jsonPath("$.data[0].dailyRentalFee").isNumber())
                .andExpect(jsonPath("$.data[0].stockQty").isNumber());
    }
}
