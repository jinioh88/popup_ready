package com.popupready.server.settlement;

/**
 * 계산된 분할 Row 하나. 저장 전 값이라 엔티티가 아니다 — 순수 계산의 출력이며 저장은 호출자가 한다.
 *
 * <p>{@code netAmount}는 <b>실제로 이체할 금액</b>이다(§2.1). 이 정의 덕에 플랫폼 Row의 net이
 * 0인 것이 누락이 아니라 "이체 대상이 아님"으로 읽히고, Sprint 3의 US-403 배치는 {@code net > 0}인
 * Row만 훑으면 된다.
 */
public record SettlementRow(
        SettlementType type, Long payeeId, long grossAmount, long feeAmount, long netAmount, SettlementStatus status) {}
