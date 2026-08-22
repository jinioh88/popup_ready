package com.popupready.server.reservation;

import com.popupready.server.common.ApiException;
import com.popupready.server.common.ErrorCode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 웹 빌더가 보낸 도면을 서버가 다시 판정한다(스프린트 문서 §2.2·§2.3).
 *
 * <p>빌더는 이미 같은 규칙으로 드롭을 막고 있지만, 빌더를 거치지 않은 요청도 같은 문을 지나야 하므로
 * 신뢰 경계는 여기다. <b>판정식은 웹과 동일해야 한다</b> — 다르면 웹에서 정상이던 배치가 결제
 * 직전에 거절된다.
 *
 * <p>의존성이 없는 순수 판정이라 스텁 없이 단위 테스트한다. 저장·조회는 호출자의 몫이고
 * 여기서는 넘겨받은 값만 본다.
 */
public final class LayoutValidator {

    private LayoutValidator() {}

    /**
     * @param layout 웹 빌더가 만든 도면
     * @param spaceGrid 공간이 실제로 가진 도면 규격 — 판정 기준은 요청이 아니라 이쪽이다
     * @param catalog 배치된 집기의 규격. 키는 fixtureId
     */
    public static void validate(LayoutDto layout, GridSpec spaceGrid, Map<Long, FixtureSpec> catalog) {
        requireMatchingGrid(layout, spaceGrid);

        List<Placement> placed = new ArrayList<>();
        for (LayoutItemDto item : layout.items()) {
            Placement placement = toPlacement(item, spaceGrid, catalog);
            requireInsideGrid(item, placement, spaceGrid);
            requireNoOverlap(item, placement, placed);
            placed.add(placement);
        }

        requireStockAvailable(layout, catalog);
    }

    /**
     * 레이아웃이 그려진 그리드와 공간의 그리드가 같아야 한다.
     *
     * <p>이 확인이 없으면 클라이언트가 임의의 그리드를 함께 보내 범위 판정을 스스로 정할 수 있어
     * 서버측 재검증이 무의미해진다. 값이 갈라지는 정상적인 경우는 웹이 낡은 공간 정보를 들고 있을
     * 때이며, 그때 필요한 것은 통과가 아니라 도면 다시 받기다.
     */
    private static void requireMatchingGrid(LayoutDto layout, GridSpec spaceGrid) {
        boolean sameGrid = layout.gridCols() == spaceGrid.gridCols()
                && layout.gridRows() == spaceGrid.gridRows()
                && layout.cellSizeMm() == spaceGrid.cellSizeMm();
        if (!sameGrid) {
            throw new ApiException(
                    ErrorCode.VALIDATION_FAILED,
                    "레이아웃 그리드가 공간 도면과 다릅니다 (공간: %d×%d, 셀 %dmm)"
                            .formatted(spaceGrid.gridCols(), spaceGrid.gridRows(), spaceGrid.cellSizeMm()));
        }
    }

    private static Placement toPlacement(LayoutItemDto item, GridSpec spaceGrid, Map<Long, FixtureSpec> catalog) {
        // 0|90|180|270만 허용한다. DTO의 Bean Validation은 0~270 범위만 보므로(정수 필드에 문자열
        // enum을 실으면 웹 생성 타입이 깨져 스펙에 열거하지 않았다) 배수 판정은 여기가 맡는다.
        if (item.rotation() % 90 != 0) {
            throw new ApiException(
                    ErrorCode.VALIDATION_FAILED,
                    "rotation은 0·90·180·270 중 하나여야 합니다 (받은 값: %d)".formatted(item.rotation()));
        }
        FixtureSpec fixture = catalog.get(item.fixtureId());
        if (fixture == null) {
            throw new ApiException(
                    ErrorCode.FIXTURE_NOT_FOUND, "집기를 찾을 수 없습니다 (fixtureId: %d)".formatted(item.fixtureId()));
        }
        return Placement.of(item, fixture, spaceGrid.cellSizeMm());
    }

    private static void requireInsideGrid(LayoutItemDto item, Placement placement, GridSpec spaceGrid) {
        if (!placement.isInsideGrid(spaceGrid.gridCols(), spaceGrid.gridRows())) {
            throw new ApiException(
                    ErrorCode.LAYOUT_OUT_OF_BOUNDS,
                    "집기가 도면 범위를 벗어납니다 (fixtureId: %d, col: %d, row: %d)"
                            .formatted(item.fixtureId(), item.col(), item.row()));
        }
    }

    private static void requireNoOverlap(LayoutItemDto item, Placement placement, List<Placement> placed) {
        if (placed.stream().anyMatch(placement::overlaps)) {
            throw new ApiException(
                    ErrorCode.LAYOUT_OVERLAP,
                    "집기의 점유 영역이 겹칩니다 (fixtureId: %d, col: %d, row: %d)"
                            .formatted(item.fixtureId(), item.col(), item.row()));
        }
    }

    /**
     * 총 재고 초과만 거른다. 같은 집기가 다른 예약에서 같은 날짜에 잡혀 있는지(날짜별 가용성)는
     * 분산 락과 함께 Sprint 2에서 본다(스프린트 문서 §8).
     */
    private static void requireStockAvailable(LayoutDto layout, Map<Long, FixtureSpec> catalog) {
        Map<Long, Integer> placedCount = new HashMap<>();
        for (LayoutItemDto item : layout.items()) {
            placedCount.merge(item.fixtureId(), 1, Integer::sum);
        }
        placedCount.forEach((fixtureId, count) -> {
            int stock = catalog.get(fixtureId).stockQty();
            if (count > stock) {
                throw new ApiException(
                        ErrorCode.FIXTURE_STOCK_EXCEEDED,
                        "집기 재고를 초과했습니다 (fixtureId: %d, 배치 %d개, 재고 %d개)".formatted(fixtureId, count, stock));
            }
        });
    }
}
