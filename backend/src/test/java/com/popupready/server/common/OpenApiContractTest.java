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
    @DisplayName("계약 스펙 → 스프린트 문서 §2.2의 10개 오퍼레이션이 모두 담긴다")
    void apiDocs_containsAllTenOperations() throws Exception {
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
                .andExpect(jsonPath("$.paths['/api/v1/contracts/{id}'].get").exists())
                // T5-3 추가 — 재진입 시 계약 ID 없이 기존 계약을 되찾는 경로.
                .andExpect(jsonPath("$.paths['/api/v1/reservation-requests/{id}/contract'].get")
                        .exists());
    }

    @Test
    @DisplayName("역할·당사자 제한이 걸린 오퍼레이션 → 403이 문서화된다")
    void apiDocs_documentsForbiddenForRestrictedOperations() throws Exception {
        // 401(인증 필요)과 403(자격 없음)은 다른 축이다. 판별 기준은 Security 설정과 같은
        // RestrictedEndpoints이므로 문서와 실제 동작이 갈라지지 않는다.
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.paths['/api/v1/reservation-requests'].post.responses.403")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/contracts/{id}'].get.responses.403")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/contracts/{id}/sign'].post.responses.403")
                        .exists());
    }

    @Test
    @DisplayName("자격 제한이 없는 오퍼레이션 → 403을 문서화하지 않는다")
    void apiDocs_omitsForbiddenWhereAnyoneMayCall() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(
                        jsonPath("$.paths['/api/v1/spaces'].get.responses.403").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/v1/auth/login'].post.responses.403")
                        .doesNotExist());
    }

    @Test
    @DisplayName("계약 생성 → 중복 생성 409가 문서화된다")
    void apiDocs_documentsConflictForContractCreation() throws Exception {
        // 생성을 멱등으로 만들지 않았으므로 웹은 409를 보고 조회 경로로 넘어간다.
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.components.schemas.ApiError.properties.code.enum")
                        .value(org.hamcrest.Matchers.hasItem("CONTRACT_ALREADY_EXISTS")));
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
    @DisplayName("본문이 다른 리소스를 지목하는 생성 오퍼레이션 → 404가 문서화된다")
    void apiDocs_documentsNotFoundWhenBodyReferencesResources() throws Exception {
        // 경로에 변수가 없어도 본문의 spaceId·fixtureId가 없으면 404가 나간다.
        // 공통 커스터마이저는 경로 변수만 보므로 이 오퍼레이션은 컨트롤러에서 직접 붙인다.
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath(
                                "$.paths['/api/v1/reservation-requests'].post.responses.404.content['application/json'].schema.$ref")
                        .value("#/components/schemas/ApiErrorResponse"));
    }

    @Test
    @DisplayName("목록·생성 오퍼레이션 → 404를 문서화하지 않는다")
    void apiDocs_omitsNotFoundWhereItCannotHappen() throws Exception {
        // 조회할 리소스를 아예 지목하지 않는 오퍼레이션에 404를 붙이면 거짓 문서가 된다.
        // (예약 요청 생성은 본문으로 지목하므로 위 테스트에서 404를 요구한다.)
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
    @DisplayName("보호된 오퍼레이션 → 401이 문서화되고 bearer 인증을 요구한다")
    void apiDocs_documentsUnauthorizedForProtectedOperations() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.paths['/api/v1/reservation-requests'].post.responses.401")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/contracts/{id}'].get.responses.401")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/contracts/{id}'].get.security")
                        .isArray());
    }

    @Test
    @DisplayName("공개 오퍼레이션 → bearer 인증을 요구하지 않는다")
    void apiDocs_publicOperationsDoNotRequireBearerAuth() throws Exception {
        // 검증할 것은 401 유무가 아니라 '인증 요구'다. login은 자격 증명 실패로 401을 내지만
        // 그것은 인증 필터가 막은 401과 종류가 다르며, 토큰 없이 부를 수 있는 경로다.
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(
                        jsonPath("$.paths['/api/v1/auth/login'].post.security").doesNotExist())
                .andExpect(
                        jsonPath("$.paths['/api/v1/auth/signup'].post.security").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/v1/spaces'].get.security").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/v1/fixtures'].get.security").doesNotExist());
    }

    @Test
    @DisplayName("자격 증명 개념이 없는 탐색 경로 → 401을 문서화하지 않는다")
    void apiDocs_discoveryOperationsHaveNoUnauthorized() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(
                        jsonPath("$.paths['/api/v1/spaces'].get.responses.401").doesNotExist())
                .andExpect(jsonPath("$.paths['/api/v1/fixtures'].get.responses.401")
                        .doesNotExist());
    }

    @Test
    @DisplayName("가입·로그인 → 실제로 나는 실패 응답이 문서화된다")
    void apiDocs_documentsAuthDomainFailures() throws Exception {
        // 공개 경로라 인증 401은 붙지 않지만, 자격 증명 실패 401과 이메일 중복 409는
        // 이 오퍼레이션이 실제로 내보내는 응답이다.
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.paths['/api/v1/auth/signup'].post.responses.409")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/auth/login'].post.responses.401")
                        .exists());
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
    @DisplayName("Sprint 2 신규 오퍼레이션 → refresh 경로가 계약에 담긴다")
    void apiDocs_containsRefreshOperation() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.paths['/api/v1/auth/refresh'].post").exists())
                // 토큰을 얻는 경로라 인증을 요구할 수 없다 — signup·login과 같은 이유다.
                .andExpect(jsonPath("$.paths['/api/v1/auth/refresh'].post.security")
                        .doesNotExist());
    }

    @Test
    @DisplayName("인증 응답 → refreshToken이 required 필드로 담긴다")
    void apiDocs_authResponseCarriesRefreshToken() throws Exception {
        // refresh 회전을 도입하면 로그인 시점에 refresh 토큰을 함께 내려야 한다.
        // 기존 오퍼레이션 2종(signup·login)의 스키마 변경이며 §2.2-B에 반영돼 있다.
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.components.schemas.AuthResponse.required")
                        .value(org.hamcrest.Matchers.containsInAnyOrder("accessToken", "refreshToken", "user")))
                .andExpect(jsonPath("$.components.schemas.TokenPairResponse.required")
                        .value(org.hamcrest.Matchers.containsInAnyOrder("accessToken", "refreshToken")));
    }

    @Test
    @DisplayName("Sprint 2 신규 오퍼레이션 → 예약 단건 조회·집기 가용성이 계약에 담긴다")
    void apiDocs_containsReadOperations() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.paths['/api/v1/reservation-requests/{id}'].get")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/spaces/{spaceId}/fixture-availability'].get")
                        .exists())
                // 예약 단건 조회는 당사자만 볼 수 있다 — 역할로는 가를 수 없다(브랜드도 건물주도 본다).
                .andExpect(jsonPath("$.paths['/api/v1/reservation-requests/{id}'].get.responses.403")
                        .exists());
    }

    @Test
    @DisplayName("집기 가용성 응답 → 총재고·예약수량·가용수량이 모두 required로 담긴다")
    void apiDocs_fixtureAvailabilityFieldsAreRequired() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.components.schemas.FixtureAvailabilityResponse.required")
                        .value(org.hamcrest.Matchers.containsInAnyOrder(
                                "fixtureId", "totalStock", "reservedQty", "availableQty")));
    }

    @Test
    @DisplayName("Sprint 2 신규 오퍼레이션 → 결제·정산·도어 5종이 계약에 담긴다")
    void apiDocs_containsPaymentSettlementDoorOperations() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.paths['/api/v1/reservation-requests/{id}/payment/prepare'].post")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/reservation-requests/{id}/payment/confirm'].post")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/settlements'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/reservation-requests/{id}/door-open'].post")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/door-events/{eventId}/ack'].post")
                        .exists());
    }

    @Test
    @DisplayName("결제·정산·도어 오퍼레이션 → 인증을 요구하고 당사자 403을 문서화한다")
    void apiDocs_sprint2OperationsRequireAuthAndDocumentForbidden() throws Exception {
        // 어느 것도 공개 경로가 아니다. 그리고 전부 역할이 아니라 당사자로 갈리므로
        // Security는 인증까지만 보고 판정은 서비스가 한다 — 그래도 403이 난다는 사실은 문서에 있어야 한다.
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(
                        jsonPath("$.paths['/api/v1/settlements'].get.security").isArray())
                .andExpect(jsonPath("$.paths['/api/v1/settlements'].get.responses.403")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/reservation-requests/{id}/payment/confirm'].post.responses.403")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/reservation-requests/{id}/door-open'].post.responses.403")
                        .exists())
                .andExpect(jsonPath("$.paths['/api/v1/door-events/{eventId}/ack'].post.responses.403")
                        .exists());
    }

    @Test
    @DisplayName("결제 승인 응답 → 정산 Row 요약을 함께 담는다")
    void apiDocs_paymentConfirmCarriesSettlements() throws Exception {
        // 별도 조회를 강제하면 "결제는 됐는데 내역은 아직"인 중간 상태가 화면에 생긴다.
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.components.schemas.PaymentConfirmResponse.required")
                        .value(org.hamcrest.Matchers.hasItem("settlements")))
                .andExpect(jsonPath("$.components.schemas.SettlementResponse.required")
                        .value(org.hamcrest.Matchers.containsInAnyOrder(
                                "type", "payeeId", "grossAmount", "feeAmount", "netAmount", "status")));
    }

    @Test
    @DisplayName("도어 오픈 응답 → 서버가 조립한 토픽·페이로드를 담는다")
    void apiDocs_doorOpenCarriesTopicAndPayload() throws Exception {
        // 클라이언트가 토픽을 조립하면 훼손된 채 발행될 수 있다(§2.3).
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.components.schemas.DoorOpenResponse.required")
                        .value(org.hamcrest.Matchers.containsInAnyOrder(
                                "eventId", "topic", "statusTopic", "payload", "status")))
                .andExpect(jsonPath("$.components.schemas.DoorCommandPayload.required")
                        .value(org.hamcrest.Matchers.containsInAnyOrder(
                                "eventId", "reservationId", "action", "issuedAt")));
    }

    @Test
    @DisplayName("모든 오퍼레이션 → operationId가 명시적으로 부여된다(_1·_2 접미사 없음)")
    void apiDocs_operationIdsAreExplicit() throws Exception {
        // springdoc은 메서드 이름이 겹치면 _1·_2를 붙이는데 그 번호는 컨트롤러 스캔 순서에
        // 달려 있다. 무관한 컨트롤러가 같은 이름의 메서드를 추가하는 것만으로 남의 operationId가
        // 밀린다 — 실제로 예약 단건 조회를 detail()로 두었을 때 /contracts/{id}가 detail_1에서
        // detail_2로 조용히 바뀌었다. 그래서 접미사가 하나라도 생기면 여기서 실패시킨다.
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$..operationId")
                        .value(org.hamcrest.Matchers.everyItem(
                                org.hamcrest.Matchers.not(org.hamcrest.Matchers.matchesPattern(".*_\\d+$")))));
    }

    @Test
    @DisplayName("계약 목록 → 19개 오퍼레이션의 operationId가 고정된다")
    void apiDocs_operationIdsArePinned() throws Exception {
        // 이 목록이 곧 계약이다. 오퍼레이션을 추가·개명하면 여기가 먼저 깨져야 한다 —
        // 소비자(웹·모바일)의 생성 타입이 조용히 바뀌는 것보다 낫다.
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$..operationId")
                        .value(org.hamcrest.Matchers.containsInAnyOrder(
                                "signup",
                                "login",
                                "refresh",
                                "searchSpaces",
                                "getSpace",
                                "getFixtureAvailability",
                                "listFixtures",
                                "createReservationRequest",
                                "getReservationRequest",
                                "listReservationRequests",
                                "createContract",
                                "getContractByReservation",
                                "getContract",
                                "signContract",
                                "preparePayment",
                                "confirmPayment",
                                "listSettlements",
                                "openDoor",
                                "ackDoorEvent")));
    }

    @Test
    @DisplayName("내 예약 목록 → 목록 경로가 계약에 담기고 status는 선택이다")
    void apiDocs_containsReservationListOperation() throws Exception {
        // 현장 운영자가 예약 ID를 외우지 않는다 — 단건 조회만으로는 모바일의 진입 경로가 없다.
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(
                        jsonPath("$.paths['/api/v1/reservation-requests'].get").exists())
                .andExpect(jsonPath("$.paths['/api/v1/reservation-requests'].get.parameters[0].required")
                        .value(false))
                // 목록은 '내 것'만 돌려주므로 남의 것을 볼 방법이 없다 — 403이 날 자리가 아니다.
                .andExpect(jsonPath("$.paths['/api/v1/reservation-requests'].get.responses.403")
                        .doesNotExist());
    }

    @Test
    @DisplayName("도어 오픈 응답 → 상태 구독 토픽도 서버가 내려준다")
    void apiDocs_doorOpenCarriesStatusTopic() throws Exception {
        // topic 문자열에서 spaceId를 파싱해 상태 토픽을 조립하는 것도 조립이다.
        // §2.3의 "서버가 내려준 것을 그대로 쓴다"는 발행 토픽에만 걸리는 규칙이 아니다.
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.components.schemas.DoorOpenResponse.required")
                        .value(org.hamcrest.Matchers.containsInAnyOrder(
                                "eventId", "topic", "statusTopic", "payload", "status")));
    }

    @Test
    @DisplayName("예약 상태 → 결제 단계 3종이 추가된 6종으로 고정된다")
    void apiDocs_reservationStatusCarriesPaymentStates() throws Exception {
        // 웹·모바일이 이 값으로 화면을 가른다. 값이 늘면 두 파트의 전수 분기가 컴파일에서
        // 먼저 깨져야 하고, 그러려면 계약에 정확히 실려 있어야 한다.
        //
        // springdoc은 이 enum을 별도 스키마로 빼지 않고 쓰는 자리마다 인라인한다. 그래서 경로가
        // ReservationStatus가 아니라 예약 응답의 status 속성이다 — 클라이언트가 실제로 읽는 자리다.
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.components.schemas.ReservationRequestResponse.properties.status.enum")
                        .value(org.hamcrest.Matchers.containsInAnyOrder(
                                "DRAFT",
                                "CONTRACT_PENDING",
                                "CONTRACT_SIGNED",
                                "PAYMENT_PENDING",
                                "PAID",
                                "CANCELLED")));
    }

    @Test
    @DisplayName("Sprint 2 에러 코드 → 신규 8종이 모두 enum에 담긴다")
    void apiDocs_carriesSprint2ErrorCodes() throws Exception {
        // 클라이언트는 이 이름으로 분기한다. 코드가 빠지면 웹·모바일의 실패 분기가 통째로
        // 죽으므로(생성 타입에 값이 없어 비교 자체가 컴파일 오류다) 목록을 여기서 잠근다.
        //
        // ⚠️ AREA_LIMIT_EXCEEDED는 없다 — 지시서 §2.2-F가 철회했다. 그리드 전체 면적이
        //    floorAreaM2보다 작아 그리드 경계 판정을 통과한 배치는 면적 한도를 넘을 수 없다.
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(jsonPath("$.components.schemas.ApiError.properties.code.enum")
                        .value(org.hamcrest.Matchers.hasItems(
                                "POWER_LIMIT_EXCEEDED",
                                "FIXTURE_UNAVAILABLE",
                                "CONTRACT_INTEGRITY_VIOLATION",
                                "PAYMENT_ALREADY_COMPLETED",
                                "PAYMENT_AMOUNT_MISMATCH",
                                "LOCK_ACQUISITION_FAILED",
                                "DOOR_NOT_YET_OPENABLE",
                                "REFRESH_TOKEN_INVALID")))
                .andExpect(jsonPath("$.components.schemas.ApiError.properties.code.enum")
                        .value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("AREA_LIMIT_EXCEEDED"))));
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
                        .value(org.hamcrest.Matchers.containsInAnyOrder("accessToken", "refreshToken", "user")))
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
