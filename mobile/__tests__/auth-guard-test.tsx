import { act, renderRouter, screen, waitFor } from "expo-router/testing-library";

/**
 * 🚧 T0 인증 가드 (지시서 §5 필수 게이트).
 *
 * 실제 `src/app` 라우트 트리를 그대로 마운트한다 — 가짜 트리로 테스트하면 정작 앱이 쓰는
 * `_layout.tsx`의 가드는 한 번도 실행되지 않는다.
 */

// SecureStore 읽기 시점을 손으로 제어해 "토큰 로딩 중" 상태를 실제로 만든다.
let resolveToken: (token: string | null) => void;
let rejectToken: (error: Error) => void;
const mockReadAccessToken = jest.fn(
  () =>
    new Promise<string | null>((resolve, reject) => {
      resolveToken = resolve;
      rejectToken = reject;
    }),
);

jest.mock("../src/lib/auth/token-storage", () => ({
  readAccessToken: () => mockReadAccessToken(),
  saveAccessToken: jest.fn(),
  clearAccessToken: jest.fn(),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: "192.168.0.10:8081" } },
}));

// 예약 상세가 렌더되면 MQTT 연결이 뜬다. 가드가 새면 이 mock이 호출되는 것으로 드러난다.
const mockConnect = jest.fn(() => ({
  on: jest.fn(),
  subscribe: jest.fn(),
  publish: jest.fn(),
  end: jest.fn(),
}));
jest.mock("mqtt", () => ({ __esModule: true, default: { connect: () => mockConnect() } }));

const APP_DIR = "./src/app";

/**
 * 딥링크가 도달하려는 경로. **스킴 문자열은 여기서 쓰지 않는다.**
 *
 * `renderRouter`의 `initialUrl`은 경로만 받는다 — `popupready://reservations/42`를 그대로
 * 넣으면 `new URL(...)`이 `reservations`를 host로 떼어내 `/42`가 되고, 테스트는 "경로 없음"으로
 * **가드와 무관하게 통과한다**(실제로 한 번 그렇게 통과했다). 스킴 해석은 OS와 expo-router
 * linking prefix의 몫이라 단위 테스트가 닿지 않는다. 실기기 확인이 별도로 필요하다:
 *   npx uri-scheme open popupready://reservations/42 --ios
 *
 * 단위 테스트가 증명할 수 있는 것은 그 다음 구간 — **로그인 화면을 거치지 않고 보호 경로에서
 * 앱이 시작되는 상황**이며, 딥링크가 가드를 뚫는다면 정확히 이 방식으로 뚫는다.
 */
const DEEP_LINK_PATH = "/reservations/42";

beforeEach(() => {
  jest.clearAllMocks();
});

/** 토큰 읽기를 끝내고 그 결과가 반영될 때까지 기다린다. */
async function settleToken(token: string | null) {
  await act(async () => {
    resolveToken(token);
  });
}

describe("T0 인증 가드", () => {
  it("G1 — 토큰이 없으면 보호 화면이 렌더되지 않고 로그인으로 간다", async () => {
    await renderRouter(APP_DIR, { initialUrl: "/reservations/42" });
    await settleToken(null);

    await waitFor(() => expect(screen.getByPlaceholderText("이메일")).toBeTruthy());
    expect(screen.queryByText("도어락 (MQTT 모킹)")).toBeNull();
    // 화면이 스쳐 지나가지도 않았음을 부작용으로 확인한다.
    expect(mockConnect).not.toHaveBeenCalled();
  });

  // 화면 이동만 막는 방식(useEffect + router.replace)은 "로그인 화면에서 출발한 이동"만
  // 잡는다. 딥링크는 출발점 자체가 보호 경로라 그 방식을 통째로 우회한다.
  //
  // **짝을 이루는 두 케이스로 둔다.** 차단만 단언하면 경로를 못 찾아 떨어져도 통과하므로,
  // 토큰이 있을 때 같은 경로가 열린다는 대조가 있어야 차단이 가드 때문임이 증명된다.
  it("G2 — 로그인 화면을 거치지 않고 보호 경로에서 시작해도 막힌다", async () => {
    await renderRouter(APP_DIR, { initialUrl: DEEP_LINK_PATH });
    await settleToken(null);

    await waitFor(() => expect(screen.getByPlaceholderText("이메일")).toBeTruthy());
    expect(screen.queryByText("도어락 (MQTT 모킹)")).toBeNull();
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("G2-대조 — 같은 경로가 토큰이 있으면 예약 상세로 열린다", async () => {
    await renderRouter(APP_DIR, { initialUrl: DEEP_LINK_PATH });
    await settleToken("jwt-abc");

    await waitFor(() => expect(screen.getByText("도어락 (MQTT 모킹)")).toBeTruthy());
    expect(screen.getByText("42")).toBeTruthy();
  });

  it("G3 — 토큰을 읽는 중에는 보호 화면도 로그인 화면도 렌더하지 않는다", async () => {
    await renderRouter(APP_DIR, { initialUrl: "/reservations/42" });

    // 아직 resolve하지 않았다 — 이 시점이 "렌더 시점 1회 판정"이 틀리는 순간이다.
    expect(screen.getByText("로그인 상태를 확인하는 중")).toBeTruthy();
    expect(screen.queryByText("도어락 (MQTT 모킹)")).toBeNull();
    expect(screen.queryByPlaceholderText("이메일")).toBeNull();

    await settleToken(null);
  });

  it("G4 — 로딩 → 인증 전이 후에는 보호 화면이 열린다", async () => {
    await renderRouter(APP_DIR, { initialUrl: "/reservations/42" });
    expect(screen.getByText("로그인 상태를 확인하는 중")).toBeTruthy();

    await settleToken("jwt-abc");

    await waitFor(() => expect(screen.getByText("도어락 (MQTT 모킹)")).toBeTruthy());
    expect(screen.queryByPlaceholderText("이메일")).toBeNull();
  });

  it("G5 — 토큰 저장소를 못 읽으면 인증으로 넘기지 않고 닫는다", async () => {
    await renderRouter(APP_DIR, { initialUrl: "/reservations/42" });

    await act(async () => {
      rejectToken(new Error("keychain unavailable"));
    });

    await waitFor(() => expect(screen.getByPlaceholderText("이메일")).toBeTruthy());
    expect(mockConnect).not.toHaveBeenCalled();
  });
});
