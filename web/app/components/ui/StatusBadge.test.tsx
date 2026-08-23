// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { StatusBadge } from "./StatusBadge";

afterEach(cleanup);

describe("StatusBadge", () => {
  it("상태를 색이 아니라 텍스트로 전달한다", () => {
    // 스타일가이드 §8 인수 조건 — 색 단독 전달 금지.
    render(<StatusBadge tone="error">한도 초과</StatusBadge>);

    expect(screen.getByText("한도 초과")).toBeTruthy();
  });

  it("아이콘은 장식이므로 낭독되지 않는다", () => {
    const { container } = render(
      <StatusBadge tone="warning" icon={<span>⚠</span>}>
        임박
      </StatusBadge>,
    );

    const decoration = container.querySelector('[aria-hidden="true"]');

    expect(decoration?.textContent).toBe("⚠");
    // 아이콘이 라벨을 대체하지 않는다 — 텍스트가 함께 남아 있어야 한다.
    expect(screen.getByText("임박")).toBeTruthy();
  });
});
