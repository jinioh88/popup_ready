package com.popupready.server.space;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.popupready.server.auth.JwtProvider;
import com.popupready.server.common.GlobalExceptionHandler;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(SpaceController.class)
// 보안 필터는 끈다. 이 슬라이스가 볼 것은 입력 검증·응답 봉투이고,
// 어느 경로가 열리고 닫히는지는 SecurityAccessTest가 못 박는다.
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class SpaceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    // @WebMvcTest는 Filter 타입 빈을 슬라이스에 포함해 JwtAuthenticationFilter가 딸려 온다.
    // 필터는 addFilters=false로 이미 무력화됐고, 여기서는 그 의존만 채워 컨텍스트를 띄운다.
    @MockitoBean
    private JwtProvider jwtProvider;

    @MockitoBean
    private SpaceService spaceService;

    @BeforeEach
    void stubSpaceService() {
        // 이 슬라이스가 보는 것은 파라미터 검증과 응답 봉투다.
        // 검색·매핑 규칙은 SpaceServiceTest가, 공간 쿼리는 SpaceSearchRepositoryTest가 맡는다.
        given(spaceService.search(anyDouble(), anyDouble(), anyInt(), any(), any(), any()))
                .willReturn(List.of(new SpaceSummaryResponse(
                        1L,
                        "성수 연무장길 팝업 1층",
                        "서울 성동구 연무장길 45",
                        new LocationDto(37.5445, 127.0557),
                        450_000L,
                        82.5,
                        5_000)));
        given(spaceService.detail(any()))
                .willReturn(new SpaceDetailResponse(
                        1L,
                        "성수 연무장길 팝업 1층",
                        "서울 성동구 연무장길 45",
                        new LocationDto(37.5445, 127.0557),
                        450_000L,
                        new java.math.BigDecimal("0.10"),
                        82.5,
                        5_000,
                        20,
                        12,
                        500,
                        SpaceStatus.ACTIVE));
    }

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
