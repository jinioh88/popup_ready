package com.popupready.server.settlement;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * 1회 결제를 다자간 분할 Row로 쪼갠다(US-203, §2.1).
 *
 * <h2>합계 불변식</h2>
 *
 * <pre>Σ(netAmount) + Σ(feeAmount) == payment.amount</pre>
 *
 * 이것이 성립하려면 수수료가 <b>정확히 한 번</b>만 세어져야 한다. 그래서 수수료는 각 payee Row의
 * {@code feeAmount}에 원천 차감으로 기록하고, {@code PLATFORM_FEE} Row는 그 합계를
 * {@code grossAmount}로 들되 {@code net}과 {@code fee}는 모두 0이다 — 플랫폼은 결제 전액을 수납한
 * 뒤 각 payee에게 net만 내보내고 나머지를 남기므로 <b>자기에게 이체할 순액이 없다</b>.
 *
 * <p>플랫폼 Row의 net을 수수료 합으로 두면 불변식에서 수수료가 두 번 세어진다. 이건 §4의 4종 Row
 * 표와 §7의 불변식이 처음에 동시에 성립하지 않던 지점이며, 위 배치가 둘을 모두 만족시키는 유일한 답이다.
 *
 * <h2>반올림</h2>
 *
 * Row별로 {@code HALF_UP}으로 맺고, <b>플랫폼 gross는 각 Row fee의 단순 합</b>으로 구한다.
 * 총액에 요율을 다시 곱하면 Row별 잔차와 1~N원 어긋난다.
 *
 * <h2>보증금</h2>
 *
 * 수수료를 물리지 않는다. 매출이 아니라 <b>반환 대상</b>이고, 수수료를 떼면 브랜드가 돌려받는 돈이
 * 줄어 보증금이 아니게 된다. 상태도 홀로 {@code ESCROW_HELD}다.
 */
public final class SettlementSplitter {

    private SettlementSplitter() {}

    public static List<SettlementRow> split(SettlementInput input, BigDecimal feeRate) {
        List<SettlementRow> rows = new ArrayList<>();

        if (input.spaceRentTotal() > 0) {
            rows.add(withFee(SettlementType.SPACE_RENT, input.landlordUserId(), input.spaceRentTotal(), feeRate));
        }
        for (VendorShare share : input.vendorShares()) {
            if (share.rentalTotal() > 0) {
                rows.add(withFee(SettlementType.FIXTURE_RENTAL, share.vendorId(), share.rentalTotal(), feeRate));
            }
        }
        if (input.deposit() > 0) {
            rows.add(new SettlementRow(
                    SettlementType.DEPOSIT,
                    input.brandUserId(),
                    input.deposit(),
                    0L,
                    input.deposit(),
                    SettlementStatus.ESCROW_HELD));
        }

        long collectedFee = rows.stream().mapToLong(SettlementRow::feeAmount).sum();
        rows.add(new SettlementRow(
                SettlementType.PLATFORM_FEE, input.platformUserId(), collectedFee, 0L, 0L, SettlementStatus.PENDING));
        return List.copyOf(rows);
    }

    /** 수수료를 원천 차감한 Row. gross는 그대로 두고 net만 줄어든다 — 얼마를 뗐는지가 남아야 한다. */
    private static SettlementRow withFee(SettlementType type, Long payeeId, long gross, BigDecimal feeRate) {
        long fee = BigDecimal.valueOf(gross)
                .multiply(feeRate)
                .setScale(0, RoundingMode.HALF_UP)
                .longValueExact();
        return new SettlementRow(type, payeeId, gross, fee, gross - fee, SettlementStatus.PENDING);
    }
}
