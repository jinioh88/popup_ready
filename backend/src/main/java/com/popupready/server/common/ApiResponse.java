package com.popupready.server.common;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 모든 API 응답의 봉투. 성공이든 실패든 이 형태를 벗어나지 않는다(스프린트 문서 §2.2).
 * data/error 중 정확히 한쪽만 채워지며, 나머지는 null로 명시 출력된다.
 */
@Schema(description = "공통 응답 봉투")
public record ApiResponse<T>(
        // nullable·required를 명시해야 웹·모바일 생성 타입이 "정확히 한쪽만 채워진다"는 봉투 규약을
        // 표현한다. 빠뜨리면 data가 non-nullable로 생성되어 에러 분기 없이 접근해도 컴파일이 통과한다.
        @Schema(
                        description = "성공 시 페이로드. 실패 시 null",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.REQUIRED)
                T data,
        @Schema(
                        description = "실패 시 에러 상세. 성공 시 null",
                        nullable = true,
                        requiredMode = Schema.RequiredMode.REQUIRED)
                ApiError error) {

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(data, null);
    }

    public static <T> ApiResponse<T> error(ErrorCode errorCode, String message) {
        return new ApiResponse<>(null, ApiError.of(errorCode, message));
    }
}
