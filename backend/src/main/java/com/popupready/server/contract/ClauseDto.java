package com.popupready.server.contract;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 계약 조항 1개. 생성 시점의 <b>전문 스냅샷</b>이며, 템플릿이 나중에 바뀌어도 이미 만들어진
 * 계약의 문구는 변하지 않는다(분쟁 시 소명 자료가 되어야 하므로).
 */
@Schema(description = "계약 조항")
public record ClauseDto(
        @Schema(description = "조항 제목", example = "제1조 (목적)") String title,
        @Schema(description = "조항 전문", example = "본 계약은 팝업스토어 단기 운영을 목적으로 한다.") String body) {}
