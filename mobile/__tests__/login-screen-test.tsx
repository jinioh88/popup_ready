import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactElement } from "react";

import LoginScreen from "../src/app/index";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));

const mockSaveAccessToken = jest.fn();
jest.mock("../src/lib/auth/token-storage", () => ({
  saveAccessToken: (token: string) => mockSaveAccessToken(token),
}));

const mockLogin = jest.fn();
jest.mock("../src/lib/api/auth", () => ({
  login: (...args: unknown[]) => mockLogin(...args),
}));

// hostUri가 없으면 베이스 URL을 못 구해 요청 전에 실패한다. 실기기와 같은 형태로 준다.
jest.mock("expo-constants", () => ({ expoConfig: { hostUri: "192.168.0.10:8081" } }));

function renderWithQuery(ui: ReactElement) {
  // gcTime을 남겨두면 캐시 정리 타이머가 열린 핸들로 남아 jest가 종료되지 않는다.
  const client = new QueryClient({
    defaultOptions: {
      queries: { gcTime: 0, retry: false },
      mutations: { gcTime: 0, retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("로그인 화면", () => {
  it("이메일·비밀번호 입력과 로그인 버튼을 렌더한다", async () => {
    // RNTL v14는 render뿐 아니라 fireEvent도 비동기다. await 없이 쓰면
    // act()가 겹쳐 이후 테스트까지 무너진다.
    await renderWithQuery(<LoginScreen />);

    expect(screen.getByPlaceholderText("이메일")).toBeTruthy();
    expect(screen.getByPlaceholderText("비밀번호")).toBeTruthy();
    expect(screen.getByText("로그인")).toBeTruthy();
  });

  it("성공하면 토큰을 저장하고 예약 목록으로 넘긴다", async () => {
    mockLogin.mockResolvedValue({ accessToken: "jwt-abc", user: { id: 1 } });
    await renderWithQuery(<LoginScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText("이메일"), "brand@popupready.com");
    await fireEvent.changeText(screen.getByPlaceholderText("비밀번호"), "password123");
    await fireEvent.press(screen.getByText("로그인"));

    await waitFor(() => expect(mockSaveAccessToken).toHaveBeenCalledWith("jwt-abc"));
    expect(mockReplace).toHaveBeenCalledWith("/reservations");

    // 공백만 넣고 보내는 실수를 막으려 이메일은 trim해서 보낸다.
    expect(mockLogin).toHaveBeenCalledWith("http://192.168.0.10:8080/api/v1", {
      email: "brand@popupready.com",
      password: "password123",
    });
  });

  it("실패하면 화면에 사유를 띄우고 넘어가지 않는다", async () => {
    const { ApiRequestError } = jest.requireActual("../src/lib/api/client");
    mockLogin.mockRejectedValue(new ApiRequestError("INVALID_CREDENTIALS", "bad", 400));
    await renderWithQuery(<LoginScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText("이메일"), "brand@popupready.com");
    await fireEvent.changeText(screen.getByPlaceholderText("비밀번호"), "wrong");
    await fireEvent.press(screen.getByText("로그인"));

    await waitFor(() =>
      expect(screen.getByText("이메일 또는 비밀번호가 올바르지 않다.")).toBeTruthy(),
    );
    expect(mockSaveAccessToken).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("입력이 비어 있으면 검증에서 막고 요청을 보내지 않는다", async () => {
    await renderWithQuery(<LoginScreen />);

    await fireEvent.press(screen.getByText("로그인"));

    await waitFor(() => expect(screen.getByText("이메일을 입력하라.")).toBeTruthy());
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("이메일 형식이 아니면 서버로 보내지 않는다", async () => {
    await renderWithQuery(<LoginScreen />);

    await fireEvent.changeText(screen.getByPlaceholderText("이메일"), "brand");
    await fireEvent.changeText(screen.getByPlaceholderText("비밀번호"), "password123");
    await fireEvent.press(screen.getByText("로그인"));

    await waitFor(() => expect(screen.getByText("이메일 형식이 아니다.")).toBeTruthy());
    expect(mockLogin).not.toHaveBeenCalled();
  });
});
