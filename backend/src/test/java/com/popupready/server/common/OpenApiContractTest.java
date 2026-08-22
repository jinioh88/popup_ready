package com.popupready.server.common;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

/**
 * /v3/api-docs 출력은 저장소 루트 contracts/openapi.json으로 커밋되어 웹·모바일의 타입 생성
 * 원천이 된다. 즉 이 응답 자체가 파트 간 계약이므로, 사람이 눈으로 확인하는 대신 여기서 잠근다.
 */
@SpringBootTest
@AutoConfigureMockMvc
class OpenApiContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("계약 스펙 → 스프린트 문서 §2.2의 9개 오퍼레이션이 모두 담긴다")
    void apiDocs_containsAllNineOperations() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/auth/signup'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/auth/login'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/spaces'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/spaces/{id}'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/fixtures'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/reservation-requests'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/reservation-requests/{id}/contract'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/contracts/{id}/sign'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/contracts/{id}'].get").exists());
    }

    @Test
    @DisplayName("성공 응답 → 미디어 타입이 application/json으로 고정된다")
    void apiDocs_successResponseIsApplicationJson() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.paths['/api/v1/auth/signup'].post.responses.201.content['application/json']")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/spaces'].get.responses.200.content['application/json']")
                        .exists());
    }

    @Test
    @DisplayName("모든 오퍼레이션 → 실패 응답 봉투(400)가 문서화된다")
    void apiDocs_documentsValidationFailureResponse() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath(
                                "$.paths['/api/v1/spaces'].get.responses.400.content['application/json'].schema.$ref")
                        .value("#/components/schemas/ApiErrorResponse"))
                .andExpect(jsonPath("$.paths['/api/v1/contracts/{id}'].get.responses.400").exists());
    }

    @Test
    @DisplayName("에러 응답 스키마 → 클라이언트 분기용 에러 코드 목록을 담는다")
    void apiDocs_errorSchemaCarriesErrorCodeEnum() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.components.schemas.ApiError.properties.code.enum").isArray())
                .andExpect(jsonPath("$.components.schemas.ApiError.properties.code.enum[0]")
                        .value("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("레이아웃 회전각 → integer 타입에 문자열 enum이 섞이지 않는다")
    void apiDocs_rotationIsIntegerWithoutStringEnum() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.components.schemas.LayoutItemDto.properties.rotation.type")
                        .value("integer"))
                .andExpect(jsonPath("$.components.schemas.LayoutItemDto.properties.rotation.maximum")
                        .value(270))
                .andExpect(jsonPath("$.components.schemas.LayoutItemDto.properties.rotation.enum")
                        .doesNotExist());
    }
}
