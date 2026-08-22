package com.popupready.server.contract;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

/**
 * 계약 열람·생성·서명의 공통 응답(US-202).
 *
 * <p>서명 타임스탬프는 타임존 해석이 갈리지 않도록 UTC {@link Instant}(ISO-8601)로 내보낸다 —
 * 표시 시각 변환은 클라이언트 몫이다. 미서명 당사자의 타임스탬프는 null이다.
 *
 * <p>서명 시각은 <b>required이면서 nullable</b>이다 — Jackson이 null 필드도 그대로 내보내므로
 * 키는 항상 존재하고 값만 null일 수 있다. 둘은 직교하는 개념이라 함께 표기해야 정확하다.
 */
@Schema(description = "계약")
public record ContractResponse(
        @Schema(description = "계약 ID", example = "1", requiredMode = REQUIRED) Long id,
        @Schema(description = "대상 예약 요청 ID", example = "1", requiredMode = REQUIRED) Long reservationRequestId,
        @Schema(
                        description = "계약 명칭. 일시사용 임대차 요건 보존을 위해 고정된 값이다",
                        example = ContractController.CONTRACT_TITLE,
                        requiredMode = REQUIRED)
                String title,
        @Schema(description = "템플릿 버전", example = "v1", requiredMode = REQUIRED) String templateVersion,
        @Schema(description = "생성 시점의 조항 전문 스냅샷", requiredMode = REQUIRED) List<ClauseDto> clauses,
        @Schema(
                        description = "조항 전문+타임스탬프의 SHA-256 무결성 해시",
                        example = "3f2b7c1d9a4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8",
                        requiredMode = REQUIRED)
                String contentHash,
        @Schema(
                        description = "브랜드 서명 시각(UTC). 미서명이면 null",
                        example = "2026-08-22T05:12:31Z",
                        nullable = true,
                        requiredMode = REQUIRED)
                Instant brandSignedAt,
        @Schema(
                        description = "건물주 서명 시각(UTC). 미서명이면 null",
                        example = "2026-08-22T06:40:02Z",
                        nullable = true,
                        requiredMode = REQUIRED)
                Instant landlordSignedAt,
        @Schema(description = "계약 상태", requiredMode = REQUIRED) ContractStatus status) {}
