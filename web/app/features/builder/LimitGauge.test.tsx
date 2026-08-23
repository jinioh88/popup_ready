// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { LimitGauge } from "./LimitGauge";
import type { LoadSummary } from "../../lib/builder/load";

afterEach(cleanup);

function load(overrides: {
  power?: Partial<LoadSummary["power"]>;
  area?: Partial<LoadSummary["area"]>;
  blocksSubmit?: boolean;
  hasUnknownFixture?: boolean;
}): LoadSummary {
  return {
    power: { watt: 1000, limit: 5000, ratio: 0.2, level: "safe", ...overrides.power },
    area: { m2: 5, gridM2: 25, ratio: 0.2, level: "safe", ...overrides.area },
    blocksSubmit: overrides.blocksSubmit ?? false,
    hasUnknownFixture: overrides.hasUnknownFixture ?? false,
  };
}

const OVER = load({
  power: { watt: 5500, limit: 5000, ratio: 1.1, level: "over" },
  blocksSubmit: true,
});

const CROWDED = load({ area: { m2: 20, gridM2: 25, ratio: 0.8, level: "crowded" } });

function meter(label: string): HTMLElement {
  return screen.getByRole("progressbar", { name: label });
}

describe("LimitGauge — 랜드마크", () => {
  it("게이지 영역이 이름을 가진 region으로 노출된다", () => {
    render(<LimitGauge load={OVER} />);

    // role 없는 div에 aria-label만 붙이면 이름이 노출되지 않는다.
    expect(screen.getByRole("region", { name: "배치 한도" })).toBeTruthy();
  });
});

describe("LimitGauge — 색 단독 전달 금지 (스타일가이드 §8 인수 조건)", () => {
  it("전력 상태를 글자로 말한다", () => {
    render(<LimitGauge load={OVER} />);

    expect(screen.getByText("한도 초과")).toBeTruthy();
  });

  it("임박도 글자로 말한다", () => {
    render(<LimitGauge load={load({ power: { ratio: 0.9, watt: 4500, level: "near" } })} />);

    expect(screen.getByText("한도 임박")).toBeTruthy();
  });

  it("수치를 텍스트로 함께 노출한다", () => {
    render(<LimitGauge load={OVER} />);

    // 색을 못 보는 경로에서도 '얼마나 넘었는지'가 읽혀야 한다.
    expect(screen.getByText(/5,500W \/ 5,000W \(110%\)/)).toBeTruthy();
  });
});

describe("LimitGauge — 두 축의 성격 구분 (sprint2.md §2.2-F)", () => {
  it("면적 축은 '한도'라고 말하지 않는다", () => {
    render(<LimitGauge load={CROWDED} />);

    // 이 축에는 한도가 없다 — aria로도 한도처럼 읽히면 안 된다.
    expect(meter("도면 점유").getAttribute("aria-valuetext")).toBe("도면 점유율 80%");
  });

  it("전력 축은 한도를 명시한다", () => {
    render(<LimitGauge load={OVER} />);

    expect(meter("소비 전력").getAttribute("aria-valuetext")).toContain("허용");
  });

  it("면적이 혼잡해도 차단 문구가 아니라 확인 안내를 쓴다", () => {
    render(<LimitGauge load={CROWDED} />);

    expect(screen.getByText(/예약 요청은 그대로 진행할 수 있습니다/)).toBeTruthy();
  });

  it("면적 축에 error 색을 쓰지 않는다", () => {
    // 이 화면에서 error 색은 곧 '차단'을 뜻한다. 면적은 차단 조건이 아니다.
    const { container } = render(<LimitGauge load={CROWDED} />);
    const areaFill = meter("도면 점유").firstElementChild;

    expect(areaFill?.className).not.toContain("bg-error");
    // 전력이 safe인데 화면 어디에도 error 경고가 떠 있으면 안 된다.
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0);
  });

  it("면적이 100%를 넘겨도 전력이 여유면 초과 경고가 없다", () => {
    render(<LimitGauge load={load({ area: { m2: 25, gridM2: 25, ratio: 1, level: "crowded" } })} />);

    expect(screen.queryByText("한도 초과")).toBeNull();
  });
});

describe("LimitGauge — 초과 알림 (WCAG 2.3.1)", () => {
  it("초과일 때만 지속 테두리와 1회 펄스를 건다", () => {
    const { container } = render(<LimitGauge load={OVER} />);

    // 반복 애니메이션이 아니라 상태 진입 시 1회다 — 클래스는 초과인 동안만 붙는다.
    expect(container.querySelector(".limit-pulse")).toBeTruthy();
    expect(container.querySelector(".border-error")).toBeTruthy();
  });

  it("여유일 때는 펄스도 테두리도 없다", () => {
    const { container } = render(<LimitGauge load={load({})} />);

    expect(container.querySelector(".limit-pulse")).toBeNull();
  });

  it("초과 사유를 얼마나 넘었는지로 알린다", () => {
    render(<LimitGauge load={OVER} />);

    expect(screen.getByRole("alert").textContent).toContain("500W");
  });
});

describe("LimitGauge — 막대 표현", () => {
  it("100%를 넘어도 막대가 넘치지 않는다", () => {
    render(<LimitGauge load={OVER} />);
    const fill = meter("소비 전력").firstElementChild as HTMLElement;

    // 넘친 양은 수치 텍스트가 말한다. 막대가 컨테이너를 뚫으면 레이아웃이 깨진다.
    expect(fill.style.width).toBe("100%");
  });

  it("aria-valuenow가 valuemax를 넘지 않고, 초과분은 valuetext가 말한다", () => {
    render(<LimitGauge load={OVER} />);
    const bar = meter("소비 전력");

    // ARIA는 valuenow가 min~max 안일 것을 요구한다. 110을 넣으면 규격 위반이다.
    expect(bar.getAttribute("aria-valuenow")).toBe("100");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
    expect(bar.getAttribute("aria-valuetext")).toContain("110%");
  });
});

describe("LimitGauge — 미상 집기", () => {
  it("합산에서 빠진 집기가 있으면 값이 실제보다 작을 수 있다고 알린다", () => {
    render(<LimitGauge load={load({ hasUnknownFixture: true })} />);

    expect(screen.getByRole("alert").textContent).toContain("실제보다 작을 수");
  });
});
