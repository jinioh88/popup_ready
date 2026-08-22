package com.popupready.server.reservation;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 견적 내역. 합계만 주면 웹이 근거를 보여줄 수 없으므로 항목을 쪼개 내려보낸다.
 *
 * <p>계산 규약(스프린트 문서 §2.2 "견적 계산 규약", 2026-08-22 확정) — 웹과 <b>동일하게</b> 구현한다:
 *
 * <pre>
 * days               = 종료일 - 시작일 + 1                       // 양끝 포함, 당일 사용은 1
 * spaceRentTotal     = days × space.dailyRent
 * fixtureRentalTotal = days × Σ(배치된 집기의 dailyRentalFee)
 * deposit            = round(spaceRentTotal × space.depositRate)  // 원 단위 HALF_UP
 * totalAmount        = spaceRentTotal + fixtureRentalTotal + deposit
 * </pre>
 *
 * <p><b>보증금 기준은 공간 대여료만이다</b> — 집기 렌털료는 넣지 않는다. 계약 조항이 "보증금 하향
 * 설계(공간 대여료 대비 소액)"를 요구하고, 일시사용 임대차 요건 보존상 보증금은 작을수록 안전하다.
 * 집기 손상은 보증금이 아니라 퇴실 검수·정산(US-401)이 담당한다.
 *
 * <p>반올림은 보증금 한 곳에서만 일어난다. 나머지는 정수 연산이라 오차가 생기지 않는다.
 */
@Schema(description = "견적 내역")
public record EstimateResponse(
        @Schema(description = "대여 일수", example = "14", requiredMode = REQUIRED) int days,
        @Schema(description = "공간 대여료 합계(원)", example = "6300000", requiredMode = REQUIRED) long spaceRentTotal,
        @Schema(description = "집기 렌털료 합계(원)", example = "420000", requiredMode = REQUIRED) long fixtureRentalTotal,
        @Schema(description = "보증금(원). 일시사용 요건상 하향 설계된다", example = "630000", requiredMode = REQUIRED) long deposit,
        @Schema(description = "총 견적(원)", example = "7350000", requiredMode = REQUIRED) long totalAmount) {}
