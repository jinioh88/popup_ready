package com.popupready.server.contract;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.popupready.server.auth.JwtPrincipal;
import com.popupready.server.auth.JwtProvider;
import com.popupready.server.auth.UserRole;
import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import com.popupready.server.common.GlobalExceptionHandler;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ContractController.class)
// 보안 필터는 끈다. 이 슬라이스가 볼 것은 라우팅·응답 봉투이고,
// 어느 경로가 열리고 닫히는지는 SecurityAccessTest가 못 박는다.
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class ContractControllerTest {

    private static final long TOKEN_USER_ID = 11L;

    @Autowired
    private MockMvc mockMvc;

    // @WebMvcTest는 Filter 타입 빈을 슬라이스에 포함해 JwtAuthenticationFilter가 딸려 온다.
    // 필터는 addFilters=false로 이미 무력화됐고, 여기서는 그 의존만 채워 컨텍스트를 띄운다.
    @MockitoBean
    private JwtProvider jwtProvider;

    @MockitoBean
    private ContractService contractService;

    /** 필터를 껐으므로 SecurityContext를 채우는 필터도 돌지 않는다. 신원은 여기서 심는다. */
    @BeforeEach
    void authenticate() {
        SecurityContextHolder.getContext()
                .setAuthentication(new UsernamePasswordAuthenticationToken(
                        new JwtPrincipal(TOKEN_USER_ID, UserRole.BRAND), null, List.of()));
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private static ContractResponse sample(ContractStatus status, Instant brandSignedAt) {
        return new ContractResponse(
                1L,
                1L,
                ContractTemplate.TITLE,
                ContractTemplate.CURRENT_VERSION,
                List.of(new ClauseDto("제1조 (목적)", "본 계약은 일시사용에 관한 것이다.")),
                "3f2b7c1d9a4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8",
                brandSignedAt,
                null,
                status);
    }

    @Test
    @DisplayName("예약 요청에 대한 계약 생성 → 201과 계약 반환")
    void create_returnsCreatedContract() throws Exception {
        given(contractService.create(1L)).willReturn(sample(ContractStatus.PENDING, null));

        mockMvc.perform(post("/api/v1/reservation-requests/1/contract"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.reservationRequestId").value(1))
                .andExpect(jsonPath("$.error").doesNotExist());
    }

    @Test
    @DisplayName("계약 생성 → 명칭은 '단기 공간사용 제휴계약'으로 고정된다")
    void create_hasFixedTitle() throws Exception {
        given(contractService.create(1L)).willReturn(sample(ContractStatus.PENDING, null));

        mockMvc.perform(post("/api/v1/reservation-requests/1/contract"))
                .andExpect(jsonPath("$.data.title").value("단기 공간사용 제휴계약"));
    }

    @Test
    @DisplayName("계약 생성 → 상태는 서명 대기(PENDING)")
    void create_startsPending() throws Exception {
        given(contractService.create(1L)).willReturn(sample(ContractStatus.PENDING, null));

        mockMvc.perform(post("/api/v1/reservation-requests/1/contract"))
                .andExpect(jsonPath("$.data.status").value("PENDING"));
    }

    @Test
    @DisplayName("이미 계약이 있는 예약에 재생성 → 409와 CONTRACT_ALREADY_EXISTS")
    void create_whenExists_returnsConflictEnvelope() throws Exception {
        willThrow(new ApiException(ErrorCode.CONTRACT_ALREADY_EXISTS, "이미 계약이 있습니다"))
                .given(contractService)
                .create(1L);

        mockMvc.perform(post("/api/v1/reservation-requests/1/contract"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONTRACT_ALREADY_EXISTS"));
    }

    @Test
    @DisplayName("예약 요청으로 계약 조회 → 200과 기존 계약 반환")
    void findByReservation_returnsExistingContract() throws Exception {
        given(contractService.findByReservation(1L)).willReturn(sample(ContractStatus.PENDING, null));

        mockMvc.perform(get("/api/v1/reservation-requests/1/contract"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reservationRequestId").value(1));
    }

    @Test
    @DisplayName("계약이 없는 예약 조회 → 404와 CONTRACT_NOT_FOUND")
    void findByReservation_missing_returnsNotFoundEnvelope() throws Exception {
        willThrow(new ApiException(ErrorCode.CONTRACT_NOT_FOUND, "아직 계약이 없습니다"))
                .given(contractService)
                .findByReservation(1L);

        mockMvc.perform(get("/api/v1/reservation-requests/1/contract"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("CONTRACT_NOT_FOUND"));
    }

    @Test
    @DisplayName("서명 요청 → 200과 갱신된 계약 반환")
    void sign_returnsUpdatedContract() throws Exception {
        Instant signedAt = Instant.parse("2026-08-23T05:12:31Z");
        given(contractService.sign(1L, TOKEN_USER_ID)).willReturn(sample(ContractStatus.PENDING, signedAt));

        mockMvc.perform(post("/api/v1/contracts/1/sign"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.brandSignedAt").value("2026-08-23T05:12:31Z"));
    }

    @Test
    @DisplayName("서명자는 본문이 아니라 토큰에서 온다")
    void sign_takesSignerFromToken() throws Exception {
        given(contractService.sign(1L, TOKEN_USER_ID)).willReturn(sample(ContractStatus.PENDING, Instant.EPOCH));

        mockMvc.perform(post("/api/v1/contracts/1/sign")).andExpect(status().isOk());

        verify(contractService).sign(eq(1L), eq(TOKEN_USER_ID));
    }

    @Test
    @DisplayName("당사자가 아닌 사용자의 서명 → 403과 NOT_CONTRACT_PARTY")
    void sign_byNonParty_returnsForbiddenEnvelope() throws Exception {
        willThrow(new ApiException(ErrorCode.NOT_CONTRACT_PARTY, "당사자가 아닙니다"))
                .given(contractService)
                .sign(1L, TOKEN_USER_ID);

        mockMvc.perform(post("/api/v1/contracts/1/sign"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("NOT_CONTRACT_PARTY"));
    }

    @Test
    @DisplayName("중복 서명 → 409와 CONTRACT_ALREADY_SIGNED")
    void sign_twice_returnsConflictEnvelope() throws Exception {
        willThrow(new ApiException(ErrorCode.CONTRACT_ALREADY_SIGNED, "이미 서명했습니다"))
                .given(contractService)
                .sign(1L, TOKEN_USER_ID);

        mockMvc.perform(post("/api/v1/contracts/1/sign"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONTRACT_ALREADY_SIGNED"));
    }

    @Test
    @DisplayName("계약 열람 → 조항 전문이 담긴다")
    void detail_containsClauses() throws Exception {
        given(contractService.detail(1L, TOKEN_USER_ID)).willReturn(sample(ContractStatus.PENDING, null));

        mockMvc.perform(get("/api/v1/contracts/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.clauses[0].title").isNotEmpty())
                .andExpect(jsonPath("$.data.clauses[0].body").isNotEmpty());
    }

    @Test
    @DisplayName("계약 열람 → 무결성 해시가 담긴다")
    void detail_containsContentHash() throws Exception {
        given(contractService.detail(1L, TOKEN_USER_ID)).willReturn(sample(ContractStatus.PENDING, null));

        mockMvc.perform(get("/api/v1/contracts/1"))
                .andExpect(jsonPath("$.data.contentHash").isNotEmpty());
    }

    @Test
    @DisplayName("계약 열람 → 양 당사자 서명 타임스탬프 필드가 존재한다")
    void detail_containsSignatureTimestampKeys() throws Exception {
        // 미서명이면 값은 null이지만 키는 있어야 한다(§2.2 required + nullable).
        given(contractService.detail(1L, TOKEN_USER_ID)).willReturn(sample(ContractStatus.PENDING, null));

        mockMvc.perform(get("/api/v1/contracts/1"))
                .andExpect(jsonPath("$.data.brandSignedAt").doesNotExist())
                .andExpect(jsonPath("$.data").value(org.hamcrest.Matchers.hasKey("brandSignedAt")))
                .andExpect(jsonPath("$.data").value(org.hamcrest.Matchers.hasKey("landlordSignedAt")));
    }
}
