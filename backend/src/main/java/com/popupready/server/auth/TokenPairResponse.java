package com.popupready.server.auth;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 토큰 재발급 결과(스프린트 문서 §2.2-A). <b>회전(rotation) 방식</b>이라 Access 토큰만이 아니라
 * Refresh 토큰도 새 것으로 바뀐다 — 쓰는 쪽은 둘 다 갈아끼워야 하고, 이전 refresh 토큰은
 * 그 즉시 무효다.
 *
 * <p>{@link AuthResponse}와 필드가 겹치지만 합치지 않는다. 재발급 시점에는 사용자 정보를 다시
 * 내려줄 이유가 없고, 합쳐 두면 응답에 {@code user}가 필요 없는데도 들어가거나 nullable이 된다.
 */
@Schema(description = "토큰 재발급 결과")
public record TokenPairResponse(
        @Schema(description = "새 JWT Access 토큰", requiredMode = REQUIRED) String accessToken,
        @Schema(description = "새 Refresh 토큰. 이전 것은 무효가 된다", requiredMode = REQUIRED) String refreshToken) {}
