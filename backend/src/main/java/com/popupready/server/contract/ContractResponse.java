package com.popupready.server.contract;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;

/**
 * 계약 열람·생성·서명의 공통 응답(US-202).
 *
 * <p>서명 타임스탬프는 타임존 해석이 갈리지 않도록 UTC {@link Instant}(ISO-8601)로 내보낸다 —
 * 표시 시각 변환은 클라이언트 몫이다. 미서명 당사자의 타임스탬프는 null이다.
 */
@Schema(description = "계약")
public record ContractResponse(
        @Schema(description = "계약 ID", example = "1") Long id,
        @Schema(description = "대상 예약 요청 ID", example = "1") Long reservationRequestId,
        @Schema(
                        description = "계약 명칭. 일시사용 임대차 요건 보존을 위해 고정된 값이다",
                        example = ContractController.CONTRACT_TITLE)
                String title,
        @Schema(description = "템플릿 버전", example = "v1") String templateVersion,
        @Schema(description = "생성 시점의 조항 전문 스냅샷") List<ClauseDto> clauses,
        @Schema(
                        description = "조항 전문+타임스탬프의 SHA-256 무결성 해시",
                        example = "3f2b7c1d9a4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8")
                String contentHash,
        @Schema(description = "브랜드 서명 시각(UTC). 미서명이면 null", example = "2026-08-22T05:12:31Z")
                Instant brandSignedAt,
        @Schema(description = "건물주 서명 시각(UTC). 미서명이면 null", example = "2026-08-22T06:40:02Z")
                Instant landlordSignedAt,
        @Schema(description = "계약 상태") ContractStatus status) {}
