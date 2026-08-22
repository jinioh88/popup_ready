package com.popupready.server.space;

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

@WebMvcTest(SpaceController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
class SpaceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("lat·lng를 준 반경 검색 → 200과 마커용 요약 배열")
    void search_withCoordinates_returnsSummaryArray() throws Exception {
        mockMvc.perform(get("/api/v1/spaces").param("lat", "37.5445").param("lng", "127.0557"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].id").isNumber())
                .andExpect(jsonPath("$.data[0].location.lat").isNumber())
                .andExpect(jsonPath("$.error").doesNotExist());
    }

    @Test
    @DisplayName("lat 누락 → 400과 VALIDATION_FAILED 에러 봉투")
    void search_missingLat_returnsBadRequestWithErrorEnvelope() throws Exception {
        mockMvc.perform(get("/api/v1/spaces").param("lng", "127.0557"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.data").doesNotExist())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("lng 누락 → 400과 VALIDATION_FAILED 에러 봉투")
    void search_missingLng_returnsBadRequestWithErrorEnvelope() throws Exception {
        mockMvc.perform(get("/api/v1/spaces").param("lat", "37.5445"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("radius·필터 미지정 → 200 (선택 파라미터)")
    void search_withoutOptionalFilters_returnsOk() throws Exception {
        mockMvc.perform(get("/api/v1/spaces").param("lat", "37.5445").param("lng", "127.0557"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("숫자가 아닌 radius → 400과 VALIDATION_FAILED 에러 봉투")
    void search_malformedRadius_returnsBadRequestWithErrorEnvelope() throws Exception {
        mockMvc.perform(get("/api/v1/spaces")
                        .param("lat", "37.5445")
                        .param("lng", "127.0557")
                        .param("radius", "가까운곳"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("상가 상세 조회 → 200과 빌더 진입용 grid 정보 포함")
    void detail_returnsGridInformationForBuilder() throws Exception {
        mockMvc.perform(get("/api/v1/spaces/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.gridCols").isNumber())
                .andExpect(jsonPath("$.data.gridRows").isNumber())
                .andExpect(jsonPath("$.data.cellSizeMm").isNumber())
                .andExpect(jsonPath("$.error").doesNotExist());
    }

    @Test
    @DisplayName("상가 상세 조회 → 요약 카드용 주소·대여료·면적·허용 전력 포함")
    void detail_returnsSummaryCardFields() throws Exception {
        mockMvc.perform(get("/api/v1/spaces/1"))
                .andExpect(jsonPath("$.data.address").isNotEmpty())
                .andExpect(jsonPath("$.data.dailyRent").isNumber())
                .andExpect(jsonPath("$.data.floorAreaM2").isNumber())
                .andExpect(jsonPath("$.data.maxPowerWatt").isNumber());
    }
}
