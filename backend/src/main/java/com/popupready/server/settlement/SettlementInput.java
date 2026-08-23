package com.popupready.server.settlement;

import java.util.List;

/**
 * 분할 계산의 입력. 금액은 전부 <b>견적 스냅샷</b>에서 온다 — 재계산하지 않는다(§2.2-E).
 *
 * @param totalAmount 결제 총액. 합계 불변식의 기준값이다
 * @param brandUserId 보증금을 돌려받을 대상
 */
public record SettlementInput(
        long spaceRentTotal,
        long fixtureRentalTotal,
        long deposit,
        long totalAmount,
        Long landlordUserId,
        Long brandUserId,
        Long platformUserId,
        List<VendorShare> vendorShares) {}
