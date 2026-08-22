package com.popupready.server.common;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 실패 응답의 error 필드. 코드는 {@link ErrorCode} 상수 목록에서만 나오며,
 * 웹/모바일은 message가 아닌 code로 분기한다(message는 표시용이라 문구가 바뀔 수 있다).
 */
@Schema(description = "에러 상세. 성공 응답에서는 null이다.")
public record ApiError(
        @Schema(
                        description = "에러 코드 상수. 클라이언트는 이 값으로 분기한다",
                        example = "VALIDATION_FAILED",
                        requiredMode = REQUIRED)
                ErrorCode code,
        @Schema(
                        description = "사람이 읽는 설명. 분기 조건으로 쓰지 말 것",
                        example = "email은 필수입니다",
                        requiredMode = REQUIRED)
                String message) {

    public static ApiError of(ErrorCode errorCode, String message) {
        return new ApiError(errorCode, message);
    }
}
