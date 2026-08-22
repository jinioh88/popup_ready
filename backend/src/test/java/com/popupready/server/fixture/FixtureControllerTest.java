package com.popupready.server.fixture;

import static org.mockito.ArgumentMatchers.any;
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

@WebMvcTest(FixtureController.class)
// 보안 필터는 끈다. 이 슬라이스가 볼 것은 입력 검증·응답 봉투이고,
// 어느 경로가 열리고 닫히는지는 SecurityAccessTest가 못 박는다.
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class FixtureControllerTest {

    @Autowired
    private MockMvc mockMvc;

    // @WebMvcTest는 Filter 타입 빈을 슬라이스에 포함해 JwtAuthenticationFilter가 딸려 온다.
    // 필터는 addFilters=false로 이미 무력화됐고, 여기서는 그 의존만 채워 컨텍스트를 띄운다.
    @MockitoBean
    private JwtProvider jwtProvider;

    @MockitoBean
    private FixtureService fixtureService;

    @BeforeEach
    void stubFixtureService() {
        // 분류 필터 규칙은 FixtureServiceTest가 맡는다. 여기서는 입력 검증과 봉투만 본다.
        given(fixtureService.list(any()))
                .willReturn(List.of(
                        new FixtureResponse(1L, "스탠드 행거 1200", FixtureCategory.HANGER, 1_200, 500, 0, 12_000L, 40)));
    }

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
