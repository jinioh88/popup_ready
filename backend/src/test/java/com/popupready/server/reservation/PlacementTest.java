package com.popupready.server.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * 점유 셀 계산은 웹 빌더(app/lib/builder/occupancy.ts)와 <b>동일한 계산식</b>이어야 한다
 * (스프린트 문서 §2.3). 한쪽만 어긋나면 웹에서 정상으로 보이던 배치가 서버에서 400으로 거절된다.
 */
class PlacementTest {

    /** 1,200 × 500mm 행거. 500mm 셀 기준 3칸 × 1칸을 차지한다. */
    private static final FixtureSpec HANGER = new FixtureSpec(3L, 1_200, 500, 0, 12_000L, 40);

    private static Placement place(int col, int row, int rotation) {
        return Placement.of(new LayoutItemDto(HANGER.fixtureId(), col, row, rotation), HANGER, 500);
    }

    @Test
    @DisplayName("규격이 셀 크기로 나누어떨어지지 않음 → 올림으로 점유 칸을 잡는다")
    void of_roundsUpPartialCells() {
        FixtureSpec showcase = new FixtureSpec(5L, 900, 600, 0, 20_000L, 10);

        Placement placement = Placement.of(new LayoutItemDto(5L, 0, 0, 0), showcase, 500);

        assertThat(placement.cols()).isEqualTo(2);
        assertThat(placement.rows()).isEqualTo(2);
    }

    @Test
    @DisplayName("회전 0도 → 폭·깊이가 그대로 점유 칸이 된다")
    void of_withoutRotation_keepsWidthAndDepth() {
        Placement placement = place(4, 2, 0);

        assertThat(placement.cols()).isEqualTo(3);
        assertThat(placement.rows()).isEqualTo(1);
    }

    @Test
    @DisplayName("회전 90도 → 점유 폭·깊이가 스왑된다")
    void of_with90Degrees_swapsWidthAndDepth() {
        Placement placement = place(4, 2, 90);

        assertThat(placement.cols()).isEqualTo(1);
        assertThat(placement.rows()).isEqualTo(3);
    }

    @Test
    @DisplayName("회전 180도 → 점유 크기는 0도와 같다")
    void of_with180Degrees_keepsWidthAndDepth() {
        assertThat(place(4, 2, 180)).isEqualTo(new Placement(4, 2, 3, 1));
    }

    @Test
    @DisplayName("회전 270도 → 점유 폭·깊이가 스왑된다")
    void of_with270Degrees_swapsWidthAndDepth() {
        assertThat(place(4, 2, 270)).isEqualTo(new Placement(4, 2, 1, 3));
    }

    @Test
    @DisplayName("점유 사각형이 그리드에 딱 맞음 → 범위 안으로 본다")
    void isInsideGrid_exactFit_isInside() {
        // 3칸짜리를 col 17에 놓으면 17·18·19를 쓴다. gridCols 20에서 마지막 칸까지가 경계다.
        assertThat(place(17, 11, 0).isInsideGrid(20, 12)).isTrue();
    }

    @Test
    @DisplayName("점유 사각형이 한 칸이라도 넘침 → 범위 밖으로 본다")
    void isInsideGrid_oneCellOver_isOutside() {
        assertThat(place(18, 0, 0).isInsideGrid(20, 12)).isFalse();
    }

    @Test
    @DisplayName("회전으로 늘어난 깊이가 넘침 → 범위 밖으로 본다")
    void isInsideGrid_rotationPushesOverEdge_isOutside() {
        // 0도면 1칸 깊이라 들어가지만, 90도로 돌리면 3칸을 먹어 row 10·11·12가 되어 넘친다.
        assertThat(place(0, 10, 0).isInsideGrid(20, 12)).isTrue();
        assertThat(place(0, 10, 90).isInsideGrid(20, 12)).isFalse();
    }

    @Test
    @DisplayName("두 사각형이 한 칸을 공유 → 겹침으로 본다")
    void overlaps_sharedCell_isOverlap() {
        assertThat(place(0, 0, 0).overlaps(place(2, 0, 0))).isTrue();
    }

    @Test
    @DisplayName("두 사각형이 맞닿기만 함 → 겹침이 아니다")
    void overlaps_touchingEdges_isNotOverlap() {
        assertThat(place(0, 0, 0).overlaps(place(3, 0, 0))).isFalse();
    }

    @Test
    @DisplayName("행이 다르면 열이 겹쳐도 → 겹침이 아니다")
    void overlaps_differentRows_isNotOverlap() {
        assertThat(place(0, 0, 0).overlaps(place(0, 1, 0))).isFalse();
    }
}
