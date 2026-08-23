// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { Field } from "./Field";

afterEach(cleanup);

/** 실제 사용 형태 — 컨트롤은 화면이 고르고 배선만 Field가 넘긴다. */
function renderField(props: Partial<Parameters<typeof Field>[0]> = {}) {
  return render(
    <Field label="이메일" {...props}>
      {(control) => <input type="email" {...control} />}
    </Field>,
  );
}

describe("Field", () => {
  it("라벨이 컨트롤을 가리킨다", () => {
    renderField();

    // getByLabelText가 찾는다는 것 자체가 htmlFor ↔ id 연결의 증거다.
    expect(screen.getByLabelText("이메일").tagName).toBe("INPUT");
  });

  it("에러를 aria-describedby로 컨트롤에 연결한다", () => {
    renderField({ error: "이메일 형식이 아닙니다." });

    const control = screen.getByLabelText("이메일");
    const describedBy = control.getAttribute("aria-describedby");

    expect(control.getAttribute("aria-invalid")).toBe("true");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe("이메일 형식이 아닙니다.");
  });

  it("에러가 없으면 aria-invalid를 붙이지 않는다", () => {
    renderField();

    const control = screen.getByLabelText("이메일");

    expect(control.getAttribute("aria-invalid")).toBeNull();
    expect(control.getAttribute("aria-describedby")).toBeNull();
  });

  it("도움말과 에러가 함께 있으면 둘 다 연결된다", () => {
    // 에러만 연결하면 도움말이 스크린리더에서 사라진다.
    renderField({ help: "회사 메일을 권장합니다.", error: "이미 가입된 이메일입니다." });

    const ids = screen.getByLabelText("이메일").getAttribute("aria-describedby")!.split(" ");
    const texts = ids.map((id) => document.getElementById(id)?.textContent);

    expect(ids).toHaveLength(2);
    expect(texts).toContain("회사 메일을 권장합니다.");
    expect(texts).toContain("이미 가입된 이메일입니다.");
  });

  it("에러는 role=alert로 즉시 알린다", () => {
    renderField({ error: "필수 항목입니다." });

    expect(screen.getByRole("alert").textContent).toBe("필수 항목입니다.");
  });

  it("여러 Field가 같은 화면에 있어도 id가 충돌하지 않는다", () => {
    render(
      <>
        <Field label="시작일">{(control) => <input type="date" {...control} />}</Field>
        <Field label="종료일">{(control) => <input type="date" {...control} />}</Field>
      </>,
    );

    const start = screen.getByLabelText("시작일").id;
    const end = screen.getByLabelText("종료일").id;

    expect(start).not.toBe(end);
  });

  it("input 외의 컨트롤도 같은 배선을 받는다", () => {
    // select·date가 각자 복제본을 만들지 않는 것이 Field를 쪼개지 않은 이유다.
    render(
      <Field label="지역" error="지역을 선택해 주세요.">
        {(control) => (
          <select {...control}>
            <option value="">전체</option>
          </select>
        )}
      </Field>,
    );

    const control = screen.getByLabelText("지역");

    expect(control.tagName).toBe("SELECT");
    expect(control.getAttribute("aria-invalid")).toBe("true");
  });
});
