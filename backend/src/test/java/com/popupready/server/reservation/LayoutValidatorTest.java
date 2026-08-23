package com.popupready.server.reservation;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 레이아웃 서버측 재검증(스프린트 문서 §2.2·§2.3). 웹 빌더가 이미 막고 있는 규칙이지만
 * 빌더를 거치지 않은 요청도 같은 규칙을 지나야 하므로 서버가 다시 판정한다.
 *
 * <p>의존성이 없는 순수 클래스라 스텁 없이 검증한다.
 */
class LayoutValidatorTest {

    /** 1,200 × 500mm — 500mm 셀에서 3칸 × 1칸. */
    /** 시드 공간의 허용 전력. 쇼케이스(350W) 2대까지는 들어가고 3대부터 넘는다. */
    private static final int MAX_POWER_WATT = 800;

    private static final FixtureSpec HANGER = new FixtureSpec(3L, 1_200, 500, 0, 12_000L, 40);

    /** 900 × 600mm — 2칸 × 2칸. 재고는 2개뿐이다. */
    private static final FixtureSpec SHOWCASE = new FixtureSpec(5L, 900, 600, 350, 20_000L, 2);

    private static final Map<Long, FixtureSpec> CATALOG = Map.of(3L, HANGER, 5L, SHOWCASE);

    private static final GridSpec SPACE_GRID = new GridSpec(20, 12, 500);

    private static LayoutDto layout(LayoutItemDto... items) {
        return new LayoutDto(20, 12, 500, List.of(items));
    }

    private static void validate(LayoutDto layout) {
        LayoutValidator.validate(layout, SPACE_GRID, MAX_POWER_WATT, CATALOG);
    }

    @Test
    @DisplayName("범위 안에 겹치지 않게 배치 → 통과한다")
    void validate_validLayout_passes() {
        assertThatCode(() -> validate(layout(new LayoutItemDto(3L, 0, 0, 0), new LayoutItemDto(5L, 4, 0, 0))))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("집기가 하나도 없는 레이아웃 → 통과한다")
    void validate_emptyLayout_passes() {
        assertThatCode(() -> validate(layout())).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("레이아웃 그리드가 공간 도면과 다름 → 다른 도면 위의 배치이므로 거부한다")
    void validate_gridMismatch_isRejected() {
        LayoutDto biggerGrid = new LayoutDto(40, 12, 500, List.of(new LayoutItemDto(3L, 0, 0, 0)));

        assertThatThrownBy(() -> validate(biggerGrid))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("셀 크기가 공간 도면과 다름 → 점유 계산 기준이 달라지므로 거부한다")
    void validate_cellSizeMismatch_isRejected() {
        LayoutDto otherCell = new LayoutDto(20, 12, 1_000, List.of(new LayoutItemDto(3L, 0, 0, 0)));

        assertThatThrownBy(() -> validate(otherCell))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("카탈로그에 없는 집기 배치 → 집기를 찾을 수 없다고 거부한다")
    void validate_unknownFixture_isRejected() {
        assertThatThrownBy(() -> validate(layout(new LayoutItemDto(999L, 0, 0, 0))))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.FIXTURE_NOT_FOUND);
    }

    @Test
    @DisplayName("90의 배수가 아닌 회전각 → 거부한다")
    void validate_rotationNotMultipleOf90_isRejected() {
        assertThatThrownBy(() -> validate(layout(new LayoutItemDto(3L, 0, 0, 45))))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    @Test
    @DisplayName("그리드 오른쪽 경계를 넘는 배치 → 범위 초과로 거부한다")
    void validate_outOfBounds_isRejected() {
        assertThatThrownBy(() -> validate(layout(new LayoutItemDto(3L, 18, 0, 0))))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.LAYOUT_OUT_OF_BOUNDS);
    }

    @Test
    @DisplayName("회전 때문에 아래쪽 경계를 넘는 배치 → 범위 초과로 거부한다")
    void validate_rotationCausesOutOfBounds_isRejected() {
        assertThatThrownBy(() -> validate(layout(new LayoutItemDto(3L, 0, 10, 90))))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.LAYOUT_OUT_OF_BOUNDS);
    }

    @Test
    @DisplayName("점유 셀이 한 칸이라도 겹치는 배치 → 겹침으로 거부한다")
    void validate_overlappingItems_isRejected() {
        assertThatThrownBy(() -> validate(layout(new LayoutItemDto(3L, 0, 0, 0), new LayoutItemDto(3L, 2, 0, 0))))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.LAYOUT_OVERLAP);
    }

    @Test
    @DisplayName("점유 사각형이 맞닿기만 하는 배치 → 겹침이 아니므로 통과한다")
    void validate_adjacentItems_passes() {
        assertThatCode(() -> validate(layout(new LayoutItemDto(3L, 0, 0, 0), new LayoutItemDto(3L, 3, 0, 0))))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("같은 집기를 재고 수만큼 배치 → 통과한다")
    void validate_stockExactlyMet_passes() {
        assertThatCode(() -> validate(layout(new LayoutItemDto(5L, 0, 0, 0), new LayoutItemDto(5L, 2, 0, 0))))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("같은 집기를 재고보다 많이 배치 → 재고 초과로 거부한다")
    void validate_stockExceeded_isRejected() {
        LayoutDto tooMany =
                layout(new LayoutItemDto(5L, 0, 0, 0), new LayoutItemDto(5L, 2, 0, 0), new LayoutItemDto(5L, 4, 0, 0));

        assertThatThrownBy(() -> validate(tooMany))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.FIXTURE_STOCK_EXCEEDED);
    }

    // ── 전력 한도 (T1-3, §2.2-B) ─────────────────────────────────────────────
    // 하드 게이트는 전력 하나다. 면적은 §2.2-F가 철회했다 — 그리드 전체 면적이 floorAreaM2보다
    // 작아 그리드 경계 판정을 통과한 배치는 면적 한도를 구조적으로 넘을 수 없다.

    @Test
    @DisplayName("합산 소비전력이 한도 안 → 통과")
    void power_withinLimit_passes() {
        LayoutDto layout = layout(new LayoutItemDto(5L, 0, 0, 0), new LayoutItemDto(5L, 3, 0, 0));

        LayoutValidator.validate(layout, SPACE_GRID, MAX_POWER_WATT, CATALOG);
    }

    @Test
    @DisplayName("합산 소비전력이 한도와 정확히 같음 → 통과(경계는 허용이다)")
    void power_exactlyAtLimit_passes() {
        // 800W 한도에 350W 두 대 = 700W. 한도를 100W로 낮춰 경계를 정확히 맞춘다.
        LayoutDto layout = layout(new LayoutItemDto(5L, 0, 0, 0));

        LayoutValidator.validate(layout, SPACE_GRID, 350, CATALOG);
    }

    @Test
    @DisplayName("합산 소비전력이 한도를 1W라도 넘으면 → POWER_LIMIT_EXCEEDED")
    void power_overLimitByOneWatt_isRejected() {
        LayoutDto layout = layout(new LayoutItemDto(5L, 0, 0, 0));

        assertThatThrownBy(() -> LayoutValidator.validate(layout, SPACE_GRID, 349, CATALOG))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.POWER_LIMIT_EXCEEDED);
    }

    @Test
    @DisplayName("같은 집기를 여러 대 놓으면 → 대수만큼 합산된다")
    void power_sumsPerPlacedUnit() {
        // 350W 2대 = 700W. 한도 699W면 넘지만 1대(350W)였다면 통과했을 값이라,
        // 종류가 아니라 배치된 개수로 세고 있음이 이 한 케이스로 드러난다.
        // (쇼케이스 재고가 2라 3대를 놓으면 재고 검사가 먼저 걸려 전력을 격리하지 못한다.)
        LayoutDto layout = layout(new LayoutItemDto(5L, 0, 0, 0), new LayoutItemDto(5L, 3, 0, 0));

        assertThatThrownBy(() -> LayoutValidator.validate(layout, SPACE_GRID, 699, CATALOG))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.POWER_LIMIT_EXCEEDED);
    }

    @Test
    @DisplayName("재고와 전력을 동시에 넘기면 → 재고 판정이 먼저 난다")
    void power_stockCheckedFirst() {
        // 순서를 못 박아 두는 이유는 클라이언트가 어느 쪽을 먼저 고쳐야 할지 알아야 하기 때문이다.
        // 재고는 "애초에 그만큼 없다"라서 전력을 줄여도 해소되지 않는다.
        LayoutDto layout =
                layout(new LayoutItemDto(5L, 0, 0, 0), new LayoutItemDto(5L, 3, 0, 0), new LayoutItemDto(5L, 6, 0, 0));

        assertThatThrownBy(() -> LayoutValidator.validate(layout, SPACE_GRID, 0, CATALOG))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getErrorCode())
                .isEqualTo(ErrorCode.FIXTURE_STOCK_EXCEEDED);
    }

    @Test
    @DisplayName("비전기 집기만 배치 → 한도가 0이어도 통과")
    void power_nonElectricFixtures_passEvenAtZeroLimit() {
        LayoutDto layout = layout(new LayoutItemDto(3L, 0, 0, 0), new LayoutItemDto(3L, 3, 0, 0));

        LayoutValidator.validate(layout, SPACE_GRID, 0, CATALOG);
    }
}
