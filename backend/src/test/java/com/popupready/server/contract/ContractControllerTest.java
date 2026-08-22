package com.popupready.server.contract;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ContractController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
class ContractControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("예약 요청에 대한 계약 생성 → 201과 계약 반환")
    void create_returnsCreatedContract() throws Exception {
        mockMvc.perform(post("/api/v1/reservation-requests/1/contract"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").isNumber())
                .andExpect(jsonPath("$.data.reservationRequestId").value(1))
                .andExpect(jsonPath("$.error").doesNotExist());
    }

    @Test
    @DisplayName("계약 생성 → 명칭은 '단기 공간사용 제휴계약'으로 고정된다")
    void create_usesFixedContractTitle() throws Exception {
        mockMvc.perform(post("/api/v1/reservation-requests/1/contract"))
                .andExpect(jsonPath("$.data.title").value("단기 공간사용 제휴계약"));
    }

    @Test
    @DisplayName("계약 생성 → 상태는 서명 대기(PENDING)")
    void create_startsInPendingStatus() throws Exception {
        mockMvc.perform(post("/api/v1/reservation-requests/1/contract"))
                .andExpect(jsonPath("$.data.status").value("PENDING"));
    }

    @Test
    @DisplayName("서명 요청 → 200과 갱신된 계약 반환")
    void sign_returnsUpdatedContract() throws Exception {
        mockMvc.perform(post("/api/v1/contracts/1/sign"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.error").doesNotExist());
    }

    @Test
    @DisplayName("계약 열람 → 조항 전문이 담긴다")
    void detail_returnsClauseSnapshot() throws Exception {
        mockMvc.perform(get("/api/v1/contracts/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.clauses").isArray())
                .andExpect(jsonPath("$.data.clauses[0].title").isNotEmpty())
                .andExpect(jsonPath("$.data.clauses[0].body").isNotEmpty());
    }

    @Test
    @DisplayName("계약 열람 → 무결성 해시가 담긴다")
    void detail_returnsContentHash() throws Exception {
        mockMvc.perform(get("/api/v1/contracts/1"))
                .andExpect(jsonPath("$.data.contentHash").isNotEmpty());
    }

    @Test
    @DisplayName("계약 열람 → 양 당사자 서명 타임스탬프 필드가 존재한다")
    void detail_returnsBothSignatureTimestampFields() throws Exception {
        mockMvc.perform(get("/api/v1/contracts/1"))
                .andExpect(jsonPath("$.data.brandSignedAt").exists())
                .andExpect(jsonPath("$.data.landlordSignedAt").exists());
    }
}
