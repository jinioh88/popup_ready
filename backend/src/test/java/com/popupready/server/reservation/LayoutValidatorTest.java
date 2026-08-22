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
    private static final FixtureSpec HANGER = new FixtureSpec(3L, 1_200, 500, 12_000L, 40);

    /** 900 × 600mm — 2칸 × 2칸. 재고는 2개뿐이다. */
    private static final FixtureSpec SHOWCASE = new FixtureSpec(5L, 900, 600, 20_000L, 2);

    private static final Map<Long, FixtureSpec> CATALOG = Map.of(3L, HANGER, 5L, SHOWCASE);

    private static final GridSpec SPACE_GRID = new GridSpec(20, 12, 500);

    private static LayoutDto layout(LayoutItemDto... items) {
        return new LayoutDto(20, 12, 500, List.of(items));
    }

    private static void validate(LayoutDto layout) {
        LayoutValidator.validate(layout, SPACE_GRID, CATALOG);
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
}
