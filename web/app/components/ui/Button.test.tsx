// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Button } from "./Button";

afterEach(cleanup);

describe("Button", () => {
  it("disabled면 클릭이 핸들러까지 도달하지 않는다", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        결제하기
      </Button>,
    );

    fireEvent.click(screen.getByRole("button", { name: "결제하기" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("type을 주지 않으면 submit이 아니라 button이다", () => {
    // 폼 안의 취소·삭제 버튼이 기본값 때문에 폼을 제출해 버리는 사고를 막는다.
    render(<Button>취소</Button>);

    expect(screen.getByRole("button", { name: "취소" })).toHaveProperty("type", "button");
  });

  it("submit이 필요하면 명시적으로 지정할 수 있다", () => {
    render(<Button type="submit">예약 요청</Button>);

    expect(screen.getByRole("button", { name: "예약 요청" })).toHaveProperty("type", "submit");
  });

  it("variant가 달라도 접근 가능한 이름은 children 그대로다", () => {
    render(<Button variant="destructive">계약 취소</Button>);

    expect(screen.getByRole("button", { name: "계약 취소" })).toBeTruthy();
  });
});

describe("Button — disabled는 눈으로도 잠겨 보여야 한다 (2026-08-25 인수 발견)", () => {
  it("주 버튼의 채도를 죽인다 — 투명도만 낮추지 않는다", () => {
    /*
     * 사용자가 전력 한도 초과로 **실제로 잠긴** 제출 버튼을 보고 "보라색임. 안잠기는듯"이라고
     * 적었다. `opacity-60`은 채도 높은 보라를 옅은 보라로 만들 뿐이고, 사람은 색으로 판정한다.
     * 로직은 맞는데 사용자에게는 잠기지 않은 것으로 보이던 자리다.
     */
    render(<Button disabled>예약 요청하기</Button>);

    const className = screen.getByRole("button").className;

    expect(className).toContain("disabled:bg-border");
    expect(className).toContain("disabled:text-text-muted");
    expect(className).not.toContain("opacity-60");
  });

  it("hover가 disabled의 약속을 되돌리지 않는다", () => {
    // CSS :hover는 disabled 버튼에도 매칭된다. enabled:로 잠그지 않으면 마우스를 올릴 때
    // 진해져서 눌리는 것처럼 보인다.
    render(<Button disabled>예약 요청하기</Button>);

    expect(screen.getByRole("button").className).toContain("enabled:hover:");
  });
});
