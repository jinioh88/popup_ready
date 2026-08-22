package com.popupready.server.reservation;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

/**
 * 빌더 완료 → 예약 요청 생성(스프린트 문서 §2.2). 브랜드 사용자는 JWT에서 꺼내므로
 * 본문에 담지 않는다.
 *
 * <p>날짜는 ISO-8601 {@code yyyy-MM-dd}로 고정한다 — 시각·타임존은 다루지 않는다.
 */
@Schema(description = "예약 요청 생성")
public record CreateReservationRequest(
        @Schema(description = "대상 공간 ID", example = "1") @NotNull(message = "spaceId는 필수입니다") Long spaceId,
        @Schema(description = "사용 시작일(yyyy-MM-dd)", example = "2026-09-01")
                @NotNull(message = "startDate는 필수입니다")
                @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
                LocalDate startDate,
        @Schema(description = "사용 종료일(yyyy-MM-dd)", example = "2026-09-14")
                @NotNull(message = "endDate는 필수입니다")
                @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
                LocalDate endDate,
        @Schema(description = "빌더가 만든 도면") @NotNull(message = "layout은 필수입니다") @Valid LayoutDto layout) {}
