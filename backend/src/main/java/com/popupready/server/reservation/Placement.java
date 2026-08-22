package com.popupready.server.reservation;

/**
 * 그리드 위 점유 사각형. {@code cols}·{@code rows}는 회전이 반영된 점유 크기다.
 *
 * <p>계산식은 웹 빌더(app/lib/builder/occupancy.ts·collision.ts)와 <b>동일해야 한다</b>
 * (스프린트 문서 §2.3). 한쪽만 고치면 웹에서 초록이던 자리가 서버에서 400으로 거절된다.
 *
 * <pre>
 * 점유 칸 = ceil(widthMm / cellSizeMm) × ceil(depthMm / cellSizeMm)
 * rotation이 90 또는 270이면 폭·깊이를 스왑한다.
 * </pre>
 */
public record Placement(int col, int row, int cols, int rows) {

    public static Placement of(LayoutItemDto item, FixtureSpec fixture, int cellSizeMm) {
        int cols = ceilDiv(fixture.widthMm(), cellSizeMm);
        int rows = ceilDiv(fixture.depthMm(), cellSizeMm);
        boolean swapped = item.rotation() == 90 || item.rotation() == 270;
        return swapped
                ? new Placement(item.col(), item.row(), rows, cols)
                : new Placement(item.col(), item.row(), cols, rows);
    }

    /** 점유 사각형이 그리드 안에 완전히 들어가는가. */
    public boolean isInsideGrid(int gridCols, int gridRows) {
        return col >= 0 && row >= 0 && col + cols <= gridCols && row + rows <= gridRows;
    }

    /** 한 칸이라도 겹치는가. 맞닿기만 하는 것은 겹침이 아니다. */
    public boolean overlaps(Placement other) {
        return col < other.col + other.cols
                && other.col < col + cols
                && row < other.row + other.rows
                && other.row < row + rows;
    }

    /** 정수 올림 나눗셈. 규격이 셀 크기로 나누어떨어지지 않으면 한 칸을 더 먹는다. */
    private static int ceilDiv(int dividend, int divisor) {
        return (dividend + divisor - 1) / divisor;
    }
}
