package com.popupready.server.common;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.popupready.server.space.SpaceController;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/**
 * 전역 예외 핸들러가 프레임워크의 정상적인 상태 코드를 500으로 덮지 않는지 지킨다.
 * catch-all 핸들러는 손대기 쉬운 자리라, 무엇을 삼키면 안 되는지를 테스트로 고정한다.
 */
@WebMvcTest(SpaceController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
class GlobalExceptionHandlerWebTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    @DisplayName("지원하지 않는 HTTP 메서드 → 500이 아니라 405")
    void unsupportedMethod_returnsMethodNotAllowed() throws Exception {
        mockMvc.perform(delete("/api/v1/spaces/1")).andExpect(status().isMethodNotAllowed());
    }

    @Test
    @DisplayName("존재하지 않는 경로 → 500이 아니라 404")
    void unknownPath_returnsNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/spaces/1/nonexistent")).andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("경로 변수 타입 불일치 → 400과 VALIDATION_FAILED 에러 봉투")
    void pathVariableTypeMismatch_returnsBadRequestWithErrorEnvelope() throws Exception {
        mockMvc.perform(get("/api/v1/spaces/일번"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"));
    }
}
