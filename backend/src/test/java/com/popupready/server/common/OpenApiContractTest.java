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
                .andExpect(
                        jsonPath("$.paths['/api/v1/reservation-requests'].post").exists())
                .andExpect(jsonPath("$.paths['/api/v1/reservation-requests/{id}/contract'].post")
                        .exists())
                .andExpect(
                        jsonPath("$.paths['/api/v1/contracts/{id}/sign'].post").exists())
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
                .andExpect(
                        jsonPath("$.paths['/api/v1/spaces'].get.responses.400.content['application/json'].schema.$ref")
                                .value("#/components/schemas/ApiErrorResponse"))
                .andExpect(jsonPath("$.paths['/api/v1/contracts/{id}'].get.responses.400")
                        .exists());
    }

    @Test
    @DisplayName("경로 변수를 받는 오퍼레이션 → 404가 문서화된다")
    void apiDocs_documentsNotFoundForResourceLookups() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.paths['/api/v1/spaces/{id}'].get.responses.404")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/contracts/{id}'].get.responses.404")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/contracts/{id}/sign'].post.responses.404")
                        .exists());
    }

    @Test
    @DisplayName("목록·생성 오퍼레이션 → 404를 문서화하지 않는다")
    void apiDocs_omitsNotFoundWhereItCannotHappen() throws Exception {
        // 조회할 리소스를 지목하지 않는 오퍼레이션에 404를 붙이면 거짓 문서가 된다.
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(
                        jsonPath("$.paths['/api/v1/spaces'].get.responses.404").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/v1/fixtures'].get.responses.404")
                        .doesNotExist())
                .andExpect(jsonPath("$.paths['/api/v1/auth/signup'].post.responses.404")
                        .doesNotExist());
    }

    @Test
    @DisplayName("요청 본문을 받는 오퍼레이션 → 415가 문서화된다")
    void apiDocs_documentsUnsupportedMediaTypeForBodyOperations() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.paths['/api/v1/auth/login'].post.responses.415")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/reservation-requests'].post.responses.415")
                        .exists())
                .andExpect(
                        jsonPath("$.paths['/api/v1/spaces'].get.responses.415").doesNotExist());
    }

    @Test
    @DisplayName("에러 응답 스키마 → 클라이언트 분기용 에러 코드 목록을 담는다")
    void apiDocs_errorSchemaCarriesErrorCodeEnum() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.components.schemas.ApiError.properties.code.enum")
                        .isArray())
                .andExpect(jsonPath("$.components.schemas.ApiError.properties.code.enum[0]")
                        .value("VALIDATION_FAILED"));
    }

    @Test
    @DisplayName("응답 봉투 → data·error가 항상 존재하는 키로 표기된다")
    void apiDocs_envelopeFieldsAreAlwaysPresent() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.components.schemas.ApiResponseAuthResponse.required")
                        .value(org.hamcrest.Matchers.containsInAnyOrder("data", "error")));
    }

    @Test
    @DisplayName("응답 봉투 → $ref 페이로드가 nullable 유니온(anyOf)으로 표기된다")
    void apiDocs_envelopeRefFieldsUseNullableUnion() throws Exception {
        // swagger-core는 $ref 속성에 nullable을 적용할 때 형제 키로 type:null을 붙인다.
        // 3.1에서 그 둘은 AND로 해석되어 어떤 값도 통과하지 못하는 모순된 스키마가 된다.
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.components.schemas.ApiResponseAuthResponse.properties.data.anyOf")
                        .isArray())
                .andExpect(jsonPath("$.components.schemas.ApiResponseAuthResponse.properties.data.type")
                        .doesNotExist())
                // 유니온의 null 쪽이 빈 스키마 {}로 나가면 "무엇이든 허용"이 되어 타입이 무의미해진다
                .andExpect(jsonPath("$.components.schemas.ApiResponseAuthResponse.properties.data.anyOf[0].$ref")
                        .value("#/components/schemas/AuthResponse"))
                .andExpect(jsonPath("$.components.schemas.ApiResponseAuthResponse.properties.data.anyOf[1].type")
                        .value("null"))
                .andExpect(jsonPath("$.components.schemas.ApiResponseAuthResponse.properties.error.anyOf[1].type")
                        .value("null"))
                .andExpect(jsonPath("$.components.schemas.ApiResponseAuthResponse.properties.error.type")
                        .doesNotExist());
    }

    @Test
    @DisplayName("응답 페이로드 → 모든 필드가 required로 표기된다")
    void apiDocs_responsePayloadFieldsAreRequired() throws Exception {
        // required가 없으면 생성 타입의 필드가 전부 optional(accessToken?)이 되어
        // 서버가 항상 채워 보내는 값에도 클라이언트가 옵셔널 체이닝을 써야 한다.
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.components.schemas.AuthResponse.required")
                        .value(org.hamcrest.Matchers.containsInAnyOrder("accessToken", "user")))
                .andExpect(jsonPath("$.components.schemas.EstimateResponse.required")
                        .value(org.hamcrest.Matchers.containsInAnyOrder(
                                "days", "spaceRentTotal", "fixtureRentalTotal", "deposit", "totalAmount")));
    }

    @Test
    @DisplayName("미서명 계약의 서명 시각 → 키는 항상 있고 값만 null이 될 수 있다")
    void apiDocs_signatureTimestampsAreRequiredButNullable() throws Exception {
        // Jackson이 null 필드도 그대로 내보내므로 키는 항상 존재한다.
        // required(키 존재)와 nullable(값이 null 가능)은 직교한다 — 둘 다 표기해야 정확하다.
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.components.schemas.ContractResponse.required")
                        .value(org.hamcrest.Matchers.hasItems("brandSignedAt", "landlordSignedAt")))
                .andExpect(jsonPath("$.components.schemas.ContractResponse.properties.brandSignedAt.type")
                        .value(org.hamcrest.Matchers.containsInAnyOrder("string", "null")));
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
