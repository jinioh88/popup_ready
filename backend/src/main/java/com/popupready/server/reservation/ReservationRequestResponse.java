package com.popupready.server.reservation;

import com.fasterxml.jackson.annotation.JsonFormat;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;

/** 생성된 예약 요청. 계약 생성(US-202)은 이 id를 받아 이어진다. */
@Schema(description = "예약 요청")
public record ReservationRequestResponse(
        @Schema(description = "예약 요청 ID", example = "1") Long id,
        @Schema(description = "대상 공간 ID", example = "1") Long spaceId,
        @Schema(description = "요청한 브랜드 사용자 ID", example = "1") Long brandUserId,
        @Schema(description = "사용 시작일", example = "2026-09-01")
                @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
                LocalDate startDate,
        @Schema(description = "사용 종료일", example = "2026-09-14")
                @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd")
                LocalDate endDate,
        @Schema(description = "서버가 재검증한 도면. 요청한 내용이 그대로 되돌아온다") LayoutDto layout,
        @Schema(description = "견적 내역") EstimateResponse estimate,
        @Schema(description = "예약 요청 상태") ReservationStatus status) {}
