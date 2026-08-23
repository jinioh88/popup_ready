// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { FixturePanel } from "./FixturePanel";
import { useBuilderStore } from "../../stores/builder";
import type { Fixture } from "../../lib/schemas/api";

/** 집기 팔레트 키보드 접근성 (sprint2-web.md I-1, Sprint 1 §5.1-2 이월). */

const FIXTURES: Fixture[] = [
  {
    id: 1,
    name: "행거 랙",
    category: "HANGER",
    widthMm: 1000,
    depthMm: 500,
    powerWatt: 0,
    dailyRentalFee: 12_000,
    stockQty: 5,
  },
  {
    id: 2,
    name: "POS 단말",
    category: "POS",
    widthMm: 500,
    depthMm: 500,
    powerWatt: 120,
    dailyRentalFee: 8_000,
    stockQty: 3,
  },
];

beforeEach(() => {
  useBuilderStore.getState().reset();
  useBuilderStore.getState().initGrid(1, { gridCols: 10, gridRows: 10, cellSizeMm: 500 });
});

afterEach(cleanup);

describe("FixturePanel — 키보드 접근성", () => {
  it("집기 항목이 버튼이라 탭으로 닿는다", () => {
    // 이전에는 `<div draggable>`이라 탭 이동조차 되지 않았다 — 배치가 아예 불가능했다.
    render(<FixturePanel fixtures={FIXTURES} isLoading={false} />);

    const item = screen.getByRole("button", { name: /행거 랙/ });

    expect(item.tagName).toBe("BUTTON");
    // 명시적 tabIndex 없이도 버튼은 기본으로 포커스 순서에 들어간다.
    expect(item.getAttribute("tabindex")).toBeNull();
  });

  it("항목을 활성화하면 배치 초안이 뜬다", () => {
    render(<FixturePanel fixtures={FIXTURES} isLoading={false} />);

    fireEvent.click(screen.getByRole("button", { name: /POS 단말/ }));

    expect(useBuilderStore.getState().draft).toMatchObject({ fixtureId: 2, col: 0, row: 0 });
  });

  it("배치 중인 항목을 aria-pressed로 알린다", () => {
    render(<FixturePanel fixtures={FIXTURES} isLoading={false} />);

    const pos = screen.getByRole("button", { name: /POS 단말/ });
    const hanger = screen.getByRole("button", { name: /행거 랙/ });

    expect(pos.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(pos);

    // 색만으로 "지금 이걸 배치 중"을 전달하면 색을 못 보는 경로에서 사라진다.
    expect(pos.getAttribute("aria-pressed")).toBe("true");
    expect(hanger.getAttribute("aria-pressed")).toBe("false");
  });

  it("드래그 경로는 그대로 남는다", () => {
    // 키보드를 여는 것이지 마우스를 대체하는 게 아니다.
    render(<FixturePanel fixtures={FIXTURES} isLoading={false} />);

    expect(screen.getByRole("button", { name: /행거 랙/ }).getAttribute("draggable")).toBe("true");
  });

  it("조작 방법을 화면에 적어둔다", () => {
    // 키보드 경로는 발견 가능성이 낮다 — 안내가 없으면 그다음 뭘 눌러야 하는지 알 수 없다.
    render(<FixturePanel fixtures={FIXTURES} isLoading={false} />);

    expect(screen.getByText(/방향키로 옮기고 Enter로 배치/)).toBeTruthy();
  });
});
