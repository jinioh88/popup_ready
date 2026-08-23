package com.popupready.server.settlement;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 다자간 분할 규칙(US-203, T3-2). 의존성 없는 순수 계산이라 스텁 없이 단위 테스트한다.
 *
 * <p><b>이 스토리의 DoD는 합계 불변식이다</b>: {@code Σ(net) + Σ(fee) == payment.amount}.
 * 1원이라도 새면 실패해야 한다.
 */
class SettlementSplitterTest {

    private static final BigDecimal RATE = new BigDecimal("0.100");

    private static final long LANDLORD = 2L;

    private static final long PLATFORM = 4L;

    private static long sum(List<SettlementRow> rows, java.util.function.ToLongFunction<SettlementRow> field) {
        return rows.stream().mapToLong(field).sum();
    }

    /** DoD 불변식. 어떤 조합에서도 성립해야 한다. */
    private static void assertBalances(List<SettlementRow> rows, long amount) {
        assertThat(sum(rows, SettlementRow::netAmount) + sum(rows, SettlementRow::feeAmount))
                .as("Σnet + Σfee == payment.amount")
                .isEqualTo(amount);
    }

    private static SettlementRow rowOf(List<SettlementRow> rows, SettlementType type) {
        return rows.stream().filter(r -> r.type() == type).findFirst().orElseThrow();
    }

    @Test
    @DisplayName("공급사 1곳 → 4종 Row가 만들어지고 합계 불변식이 성립한다")
    void split_singleVendor_balances() {
        SettlementInput input = new SettlementInput(
                6_300_000L,
                420_000L,
                630_000L,
                7_350_000L,
                LANDLORD,
                1L,
                PLATFORM,
                List.of(new VendorShare(3L, 420_000L)));

        List<SettlementRow> rows = SettlementSplitter.split(input, RATE);

        assertThat(rows)
                .extracting(SettlementRow::type)
                .containsExactlyInAnyOrder(
                        SettlementType.SPACE_RENT,
                        SettlementType.FIXTURE_RENTAL,
                        SettlementType.DEPOSIT,
                        SettlementType.PLATFORM_FEE);
        assertBalances(rows, 7_350_000L);
    }

    @Test
    @DisplayName("🚨 보증금 Row → ESCROW_HELD이고 수수료가 0이다")
    void deposit_isEscrowHeldWithoutFee() {
        // 보증금은 매출이 아니라 반환 대상이다. 수수료를 물리면 브랜드가 돌려받는 돈이 줄어
        // 보증금이 아니게 된다.
        SettlementInput input =
                new SettlementInput(6_300_000L, 0L, 630_000L, 6_930_000L, LANDLORD, 1L, PLATFORM, List.of());

        SettlementRow deposit = rowOf(SettlementSplitter.split(input, RATE), SettlementType.DEPOSIT);

        assertThat(deposit.status()).isEqualTo(SettlementStatus.ESCROW_HELD);
        assertThat(deposit.feeAmount()).isZero();
        assertThat(deposit.netAmount()).isEqualTo(630_000L);
    }

    @Test
    @DisplayName("🚨 플랫폼 Row → gross는 수수료 합이고 net은 0이다")
    void platformRow_grossIsFeeSumAndNetIsZero() {
        // net은 "실제로 이체할 금액"이다(§2.1). 플랫폼은 전액을 수납한 뒤 각 payee에게 net만
        // 내보내고 나머지를 남기므로 자기에게 이체할 순액이 없다.
        // net을 수수료 합으로 두면 불변식에서 수수료가 두 번 세어진다.
        SettlementInput input = new SettlementInput(
                6_300_000L,
                420_000L,
                630_000L,
                7_350_000L,
                LANDLORD,
                1L,
                PLATFORM,
                List.of(new VendorShare(3L, 420_000L)));

        List<SettlementRow> rows = SettlementSplitter.split(input, RATE);
        SettlementRow platform = rowOf(rows, SettlementType.PLATFORM_FEE);

        assertThat(platform.netAmount()).isZero();
        assertThat(platform.grossAmount()).isEqualTo(sum(rows, SettlementRow::feeAmount));
    }

    @Test
    @DisplayName("공급사 3곳 → 공급사별로 Row가 나뉘고 합계가 유지된다")
    void split_multipleVendors_separatesRows() {
        SettlementInput input = new SettlementInput(
                6_300_000L,
                600_000L,
                630_000L,
                7_530_000L,
                LANDLORD,
                1L,
                PLATFORM,
                List.of(new VendorShare(3L, 300_000L), new VendorShare(5L, 200_000L), new VendorShare(9L, 100_000L)));

        List<SettlementRow> rows = SettlementSplitter.split(input, RATE);

        assertThat(rows.stream().filter(r -> r.type() == SettlementType.FIXTURE_RENTAL))
                .hasSize(3)
                .extracting(SettlementRow::payeeId)
                .containsExactlyInAnyOrder(3L, 5L, 9L);
        assertBalances(rows, 7_530_000L);
    }

    @Test
    @DisplayName("집기 없는 예약 → 렌털료 Row가 없고 합계는 그대로 성립한다")
    void split_noFixtures_omitsRentalRows() {
        SettlementInput input =
                new SettlementInput(6_300_000L, 0L, 630_000L, 6_930_000L, LANDLORD, 1L, PLATFORM, List.of());

        List<SettlementRow> rows = SettlementSplitter.split(input, RATE);

        assertThat(rows).noneMatch(r -> r.type() == SettlementType.FIXTURE_RENTAL);
        assertBalances(rows, 6_930_000L);
    }

    @Test
    @DisplayName("🚨 반올림 잔차가 생기는 금액 → 1원도 새지 않는다")
    void split_withRoundingRemainder_stillBalances() {
        // 333,333 × 10% = 33,333.3 → HALF_UP 33,333. 총액에 요율을 다시 곱해 플랫폼 gross를
        // 구하면 Row별 잔차와 어긋난다. gross는 각 Row fee의 단순 합이어야 한다.
        SettlementInput input = new SettlementInput(
                333_333L,
                166_667L,
                33_333L,
                533_333L,
                LANDLORD,
                1L,
                PLATFORM,
                List.of(new VendorShare(3L, 55_555L), new VendorShare(5L, 111_112L)));

        List<SettlementRow> rows = SettlementSplitter.split(input, RATE);

        assertBalances(rows, 533_333L);
    }

    @Test
    @DisplayName("공간 대여료 Row → 수수료가 원천 차감되고 net은 그만큼 줄어든다")
    void spaceRent_feeIsWithheld() {
        SettlementInput input =
                new SettlementInput(6_300_000L, 0L, 630_000L, 6_930_000L, LANDLORD, 1L, PLATFORM, List.of());

        SettlementRow rent = rowOf(SettlementSplitter.split(input, RATE), SettlementType.SPACE_RENT);

        assertThat(rent.payeeId()).isEqualTo(LANDLORD);
        assertThat(rent.grossAmount()).isEqualTo(6_300_000L);
        assertThat(rent.feeAmount()).isEqualTo(630_000L);
        assertThat(rent.netAmount()).isEqualTo(5_670_000L);
    }
}
