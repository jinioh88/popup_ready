package com.popupready.server.reservation;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.List;

/**
 * 웹 빌더가 만들고 ReservationRequest.layout(JSONB)에 저장되는 도면(스프린트 문서 §2.3).
 * 이 스키마는 웹·백엔드 공통 계약이므로 필드명을 바꾸면 빌더가 깨진다.
 */
@Schema(description = "2D 도면 레이아웃")
public record LayoutDto(
        @Schema(description = "그리드 가로 칸 수", example = "20")
                @NotNull(message = "gridCols는 필수입니다")
                @Positive(message = "gridCols는 1 이상이어야 합니다")
                Integer gridCols,
        @Schema(description = "그리드 세로 칸 수", example = "12")
                @NotNull(message = "gridRows는 필수입니다")
                @Positive(message = "gridRows는 1 이상이어야 합니다")
                Integer gridRows,
        @Schema(description = "그리드 한 칸의 실제 크기(mm)", example = "500")
                @NotNull(message = "cellSizeMm는 필수입니다")
                @Positive(message = "cellSizeMm는 1 이상이어야 합니다")
                Integer cellSizeMm,
        @Schema(description = "배치된 집기 목록. 빈 배열도 허용한다")
                @NotNull(message = "items는 필수입니다")
                @Valid
                List<LayoutItemDto> items) {}
