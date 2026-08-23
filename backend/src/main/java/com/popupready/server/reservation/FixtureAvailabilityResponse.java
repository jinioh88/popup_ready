package com.popupready.server.reservation;

import static io.swagger.v3.oas.annotations.media.Schema.RequiredMode.REQUIRED;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * 날짜별 집기 가용 수량(스프린트 문서 §2.2-A). 빌더가 배치 <b>전에</b> 품절을 보여주기 위한 값이며,
 * 배치한 뒤 결제에서 409를 맞는 것보다 앞에서 막는 편이 낫다.
 *
 * <p><b>{@code availableQty}는 질의 기간 중 가장 빡빡한 날 기준이다</b> — 날짜별 예약 수량을 구한 뒤
 * 그 <b>최댓값</b>을 {@code reservedQty}로 삼는다. 기간 합계로 세면 과다 차감되고, 평균으로 세면
 * 가장 붐비는 날에 품절이 뚫린다.
 *
 * <p><b>{@code reservedQty}는 공간을 가리지 않고 센다.</b> 집기는 공간에 매이지 않으므로 다른 공간의
 * 예약이 잡아간 수량도 그대로 차감돼야 한다 — 공간별로 세면 서로 다른 공간의 두 예약이 같은 집기의
 * 마지막 1개를 나눠 갖는다.
 */
@Schema(description = "날짜별 집기 가용 수량")
public record FixtureAvailabilityResponse(
        @Schema(description = "집기 ID", example = "1", requiredMode = REQUIRED) Long fixtureId,
        @Schema(description = "총 보유 수량", example = "10", requiredMode = REQUIRED) int totalStock,
        @Schema(description = "질의 기간 중 가장 많이 잡힌 날의 예약 수량", example = "3", requiredMode = REQUIRED) int reservedQty,
        @Schema(description = "배치 가능 수량 (totalStock - reservedQty)", example = "7", requiredMode = REQUIRED)
                int availableQty) {}
