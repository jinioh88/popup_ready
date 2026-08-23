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
