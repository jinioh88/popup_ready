// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CanvasController } from "./CanvasController";
import { useBuilderStore } from "../../stores/builder";
import type { FixtureCatalog } from "./queries";

const CATALOG: FixtureCatalog = {
  1: {
    id: 1,
    name: "행거 랙",
    category: "HANGER",
    widthMm: 1000,
    depthMm: 500,
    powerWatt: 0,
    dailyRentalFee: 12_000,
    stockQty: 5,
  },
};

const store = () => useBuilderStore.getState();

beforeEach(() => {
  store().reset();
  store().initGrid(1, { gridCols: 10, gridRows: 10, cellSizeMm: 500 });
});

afterEach(cleanup);

function renderController(rejection: string | null = null, overPlacedNames: string[] = []) {
  const onRejected = vi.fn();
  render(
    <CanvasController
      fixtures={CATALOG}
      onRejected={onRejected}
      rejection={rejection}
      overPlacedNames={overPlacedNames}
    />,
  );
  return onRejected;
}

describe("CanvasController — 맥락에 맞는 안내", () => {
  it("아무것도 없으면 시작 방법을 안내한다", () => {
    renderController();

    expect(screen.getByText(/끌어다 놓거나 팔레트에서 Enter로 배치/)).toBeTruthy();
  });

  it("배치 중에는 초안 조작을 안내한다", () => {
    // 배치 중 R·Enter·Esc는 초안의 것이다 — 선택된 집기 조작 안내를 그대로 두면 헷갈린다.
    store().startDraft(1, CATALOG);
    renderController();

    expect(screen.getByText(/방향키로 옮기고 Enter로 놓습니다/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /삭제/ })).toBeNull();
  });

  it("배치된 집기를 선택하면 회전·삭제를 연다", () => {
    store().placeItem({ fixtureId: 1, col: 0, row: 0, rotation: 0 }, CATALOG);
    renderController();

    expect(screen.getByRole("button", { name: /90° 회전/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "삭제" })).toBeTruthy();
  });

  it("배치 중이면 선택이 있어도 초안 안내가 이긴다", () => {
    // placeItem이 배치 직후 선택을 남기므로 '선택 있음 + 배치 중'은 기본 경로다.
    store().placeItem({ fixtureId: 1, col: 0, row: 0, rotation: 0 }, CATALOG);
    store().startDraft(1, CATALOG);
    renderController();

    expect(screen.getByText(/방향키로 옮기고 Enter로 놓습니다/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /90° 회전/ })).toBeNull();
  });
});

describe("CanvasController — 조작", () => {
  it("삭제하면 배치에서 빠진다", () => {
    store().placeItem({ fixtureId: 1, col: 0, row: 0, rotation: 0 }, CATALOG);
    renderController();

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    expect(store().items).toHaveLength(0);
  });

  it("회전이 거부되면 사유를 올린다", () => {
    // 세로로 꽉 찬 자리에서 가로 집기를 돌리면 범위를 벗어난다.
    store().initGrid(2, { gridCols: 2, gridRows: 1, cellSizeMm: 500 });
    store().placeItem({ fixtureId: 1, col: 0, row: 0, rotation: 0 }, CATALOG);
    const onRejected = renderController();

    fireEvent.click(screen.getByRole("button", { name: /90° 회전/ }));

    expect(onRejected).toHaveBeenCalledWith("회전하면 도면 범위를 벗어납니다.");
    // 거부됐으므로 회전은 반영되지 않는다.
    expect(store().items[0]).toMatchObject({ rotation: 0 });
  });
});

describe("CanvasController — 거부 경고", () => {
  it("거부 사유를 alert로 알린다", () => {
    // Konva 캔버스의 시각 피드백만으로는 스크린리더에 아무것도 남지 않는다.
    renderController("다른 집기와 겹쳐 배치할 수 없습니다.");

    expect(screen.getByRole("alert").textContent).toBe("다른 집기와 겹쳐 배치할 수 없습니다.");
  });

  it("사유가 없으면 빈 alert를 남기지 않는다", () => {
    renderController(null);

    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("CanvasController — 초과 배치 경고 (I-3)", () => {
  it("수량이 부족한 집기를 이름으로 짚어 준다", () => {
    // 캔버스에서 조용히 빼면 도면이 왜 바뀌었는지 알 수 없다 — 무엇을 뺄지 사용자가 정한다.
    renderController(null, ["행거 랙", "POS 단말"]);

    const alert = screen.getByRole("alert");

    expect(alert.textContent).toContain("행거 랙");
    expect(alert.textContent).toContain("POS 단말");
  });

  it("초과가 없으면 경고하지 않는다", () => {
    renderController(null, []);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("거부 문구와 초과 경고는 함께 뜰 수 있다", () => {
    // 수명이 다르다 — 거부는 곧 사라지고 초과는 집기를 뺄 때까지 남는다.
    renderController("다른 집기와 겹쳐 배치할 수 없습니다.", ["행거 랙"]);

    expect(screen.getAllByRole("alert")).toHaveLength(2);
  });
});
