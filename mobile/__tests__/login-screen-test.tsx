import { render, screen } from "@testing-library/react-native";

import LoginScreen from "../src/app/index";

describe("로그인 화면", () => {
  it("이메일·비밀번호 입력과 로그인 버튼을 렌더한다", async () => {
    // RNTL v14의 render는 비동기다 — await 없이 쓰면 쿼리가 undefined가 된다.
    await render(<LoginScreen />);

    expect(screen.getByPlaceholderText("이메일")).toBeTruthy();
    expect(screen.getByPlaceholderText("비밀번호")).toBeTruthy();
    expect(screen.getByText("로그인")).toBeTruthy();
  });
});
