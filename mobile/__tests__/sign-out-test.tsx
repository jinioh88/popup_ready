import { act, fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

/**
 * 로그아웃 — T0 가드의 반대 방향.
 *
 * 이 경로가 없으면 **앱 안에서 로그아웃 상태를 만들 수 없다.** SecureStore의 토큰은 앱을
 * 종료해도 남으므로, 딥링크 차단 인수 테스트(docs §11.1-A)가 "미로그인 상태에서 시작"을
 * 전제할 수 없게 된다. 실제로 인수 테스트 첫 시도가 그래서 예약 목록으로 열렸다.
 *
 * **짝으로 둔다** — 누르기 전에 보호 화면이 실제로 떠 있었는지까지 본다. 그것 없이 "로그인
 * 화면이 보인다"만 단언하면 버튼이 아예 안 눌려도 통과한다.
 */

let resolveToken: (token: string | null) => void;
const mockReadAccessToken = jest.fn(
  () =>
    new Promise<string | null>((resolve) => {
      resolveToken = resolve;
    }),
);
const mockClearTokens = jest.fn(() => Promise.resolve());

jest.mock("../src/lib/auth/token-storage", () => ({
  readAccessToken: () => mockReadAccessToken(),
  saveTokens: jest.fn(),
  clearTokens: () => mockClearTokens(),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: "192.168.0.10:8081" } },
}));

jest.mock("../src/lib/api/reservations", () => ({
  ...jest.requireActual("../src/lib/api/reservations"),
  fetchMyReservations: () => Promise.resolve([]),
}));

const APP_DIR = "./src/app";

beforeEach(() => {
  jest.clearAllMocks();
  mockClearTokens.mockImplementation(() => Promise.resolve());
});

async function settleToken(token: string | null) {
  await act(async () => {
    resolveToken(token);
  });
}

describe("로그아웃", () => {
  it("헤더의 로그아웃을 누르면 토큰을 지우고 로그인 화면으로 돌아간다", async () => {
    await renderRouter(APP_DIR, { initialUrl: "/reservations" });
    await settleToken("jwt-abc");

    // 대조 — 누르기 전에는 보호 화면이 떠 있다.
    await waitFor(() => expect(screen.getByText("아직 예약이 없다.")).toBeTruthy());

    await fireEvent.press(screen.getByText("로그아웃"));

    await waitFor(() => expect(screen.getByPlaceholderText("이메일")).toBeTruthy());
    expect(mockClearTokens).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("아직 예약이 없다.")).toBeNull();
  });

  it("토큰을 못 지우면 로그아웃된 척하지 않는다", async () => {
    mockClearTokens.mockImplementation(() => Promise.reject(new Error("keychain unavailable")));

    await renderRouter(APP_DIR, { initialUrl: "/reservations" });
    await settleToken("jwt-abc");
    await waitFor(() => expect(screen.getByText("아직 예약이 없다.")).toBeTruthy());

    await fireEvent.press(screen.getByText("로그아웃"));

    // 토큰이 남았으므로 보호 화면도 남는다. 실패를 화면에 드러낸다.
    await waitFor(() => expect(screen.getByText("로그아웃 실패")).toBeTruthy());
    expect(screen.queryByPlaceholderText("이메일")).toBeNull();
  });
});
