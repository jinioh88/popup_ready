package com.popupready.server.reservation;

/**
 * 도면 그리드 규격. 공간이 가진 값과 레이아웃이 그려진 값이 같아야 같은 도면 위의 배치다.
 *
 * <p>셀 크기까지 포함하는 이유는 점유 셀 계산의 분모이기 때문이다 —
 * {@code cellSizeMm}가 다르면 같은 좌표라도 실제로 덮는 면적이 달라진다.
 */
public record GridSpec(int gridCols, int gridRows, int cellSizeMm) {}
