// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { Card } from "./Card";

afterEach(cleanup);

describe("Card", () => {
  it("기본은 div이지만 시맨틱 요소로 바꿀 수 있다", () => {
    // 카드는 시각 규격이지 문서 구조가 아니다 — 항상 div면 스크린리더에서 구조가 뭉개진다.
    const { container } = render(<Card>본문</Card>);
    expect(container.firstElementChild?.tagName).toBe("DIV");

    cleanup();

    render(
      <Card as="article" aria-label="계약서">
        조항
      </Card>,
    );
    expect(screen.getByRole("article", { name: "계약서" })).toBeTruthy();
  });

  it("전달한 props가 그대로 요소에 붙는다", () => {
    render(
      <Card as="form" aria-label="예약 요청">
        <button type="submit">제출</button>
      </Card>,
    );

    expect(screen.getByRole("form", { name: "예약 요청" })).toBeTruthy();
  });
});
