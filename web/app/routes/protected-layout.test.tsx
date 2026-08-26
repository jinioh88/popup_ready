// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";

import ProtectedLayout from "./protected-layout";
import { clearSession, setSession } from "../lib/api/token";

/**
 * 인증 가드 (§8.6).
 *
 * **테스트가 화면 조립부에 있어야 하는 이유**: 결함은 "토큰이 없으면 막는가"가 아니라
 * **"보고 있는 도중에 토큰이 사라지면 어떻게 되는가"**였다. 앞엣것은 컴포넌트를 한 번
 * 렌더해 보면 알 수 있지만, 뒤엣것은 **화면이 떠 있는 상태에서 세션이 바뀌는** 것을
 * 재현해야만 드러난다 — 인수 테스트에서 한 시간이 지나 토큰이 만료됐을 때 그랬다.
 *
 * §8.5가 **새로고침**을 못 견딘 방어였다면 이것은 **리렌더 없음**을 못 견딘 방어였다.
 */

const USER = { id: 7, email: "brand@popupready.com", name: "김브랜드", role: "BRAND" };

function renderGuardedScreen() {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: ProtectedLayout,
      children: [{ path: "spaces", Component: () => <p>상가 목록</p> }],
    },
    { path: "/login", Component: () => <p>로그인 화면</p> },
  ]);

  render(<Stub initialEntries={["/spaces"]} />);
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("ProtectedLayout — 진입 시점", () => {
  it("토큰이 없으면 로그인으로 보낸다", () => {
    renderGuardedScreen();

    expect(screen.getByText("로그인 화면")).toBeTruthy();
  });

  it("토큰이 있으면 보호 화면을 보여준다", () => {
    setSession("token-abc", USER);
    renderGuardedScreen();

    expect(screen.getByText("상가 목록")).toBeTruthy();
  });
});

describe("ProtectedLayout — 보고 있는 도중에 세션이 끝나면 (2026-08-25 인수 발견)", () => {
  it("401로 토큰이 비워지는 순간 로그인으로 보낸다", () => {
    /*
     * 이것이 결함의 얼굴이다. 사용자는 로그인된 상태로 빌더를 쓰다가 한 시간이 지나
     * "예약 요청하기"를 눌렀고, 401을 받았다. `apiRequest`가 토큰을 비우는 것까지는
     * 설계대로였는데 **가드가 렌더 시점에 한 번만 판정해서** 리렌더가 일어나지 않았다.
     *
     * 결과: 로그인으로 보내지지 않고 화면에 에러 문구만 뜬 채 남는다. 이후 모든 요청이
     * 401로 되풀이되는데 **사용자는 자기가 로그아웃됐다는 것을 모른다.**
     */
    setSession("token-abc", USER);
    renderGuardedScreen();
    expect(screen.getByText("상가 목록")).toBeTruthy();

    // 뮤테이션 안에서 401을 받았을 때 `apiRequest`가 하는 일과 같다.
    act(() => clearSession());

    expect(screen.queryByText("상가 목록")).toBeNull();
    expect(screen.getByText("로그인 화면")).toBeTruthy();
  });

  it("다른 탭에서 로그아웃해도 따라간다", () => {
    // 같은 탭의 변경에는 storage 이벤트가 오지 않으므로 둘 다 필요하다.
    setSession("token-abc", USER);
    renderGuardedScreen();

    act(() => {
      window.localStorage.removeItem("popupready.accessToken");
      window.dispatchEvent(new StorageEvent("storage", { key: "popupready.accessToken" }));
    });

    expect(screen.getByText("로그인 화면")).toBeTruthy();
  });
});
