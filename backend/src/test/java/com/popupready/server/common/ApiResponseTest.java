package com.popupready.server.common;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ApiResponseTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("성공 응답 → data에 payload가 담기고 error는 null")
    void ok_wrapsPayloadAndLeavesErrorNull() {
        ApiResponse<String> response = ApiResponse.ok("payload");

        assertThat(response.data()).isEqualTo("payload");
        assertThat(response.error()).isNull();
    }

    @Test
    @DisplayName("성공 응답 직렬화 → error 필드가 null로 명시 출력된다")
    void ok_serializesErrorFieldAsExplicitNull() throws Exception {
        String json = objectMapper.writeValueAsString(ApiResponse.ok("payload"));

        assertThat(json).isEqualTo("{\"data\":\"payload\",\"error\":null}");
    }

    @Test
    @DisplayName("실패 응답 → error에 코드·메시지가 담기고 data는 null")
    void error_wrapsCodeAndMessageAndLeavesDataNull() {
        ApiResponse<Void> response = ApiResponse.error(ErrorCode.VALIDATION_FAILED, "email은 필수입니다");

        assertThat(response.data()).isNull();
        assertThat(response.error().code()).isEqualTo(ErrorCode.VALIDATION_FAILED);
        assertThat(response.error().message()).isEqualTo("email은 필수입니다");
    }

    @Test
    @DisplayName("실패 응답 직렬화 → data 필드가 null로 명시 출력된다")
    void error_serializesDataFieldAsExplicitNull() throws Exception {
        String json = objectMapper.writeValueAsString(ApiResponse.error(ErrorCode.SPACE_NOT_FOUND, "없음"));

        assertThat(json).isEqualTo("{\"data\":null,\"error\":{\"code\":\"SPACE_NOT_FOUND\",\"message\":\"없음\"}}");
    }
}
