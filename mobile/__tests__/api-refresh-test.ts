import {
  authedRequest,
  resetAuthClientState,
  setSessionExpiredHandler,
} from "../src/lib/api/authed-client";
import { ApiRequestError } from "../src/lib/api/client";

/**
 * 만료 토큰 재발급 (지시서 §5 · T0 인증 가드 G6~G8).
 *
 * 저장소는 메모리로 대체해 실제 SecureStore 없이 회전 동작을 본다.
 */
let mockStored: Record<string, string | null>;

jest.mock("../src/lib/auth/token-storage", () => ({
  readAccessToken: () => Promise.resolve(mockStored.access),
  readRefreshToken: () => Promise.resolve(mockStored.refresh),
  saveTokens: ({ accessToken, refreshToken }: { accessToken: string; refreshToken: string }) => {
    mockStored.access = accessToken;
    mockStored.refresh = refreshToken;
    return Promise.resolve();
  },
  clearTokens: () => {
    mockStored.access = null;
    mockStored.refresh = null;
    return Promise.resolve();
  },
}));

const BASE = "http://192.168.0.10:8080/api/v1";

function envelope(data: unknown, status = 200) {
  return { ok: status < 400, status, json: async () => ({ data, error: null }) };
}

function failure(code: string, status: number) {
  return {
    ok: false,
    status,
    json: async () => ({ data: null, error: { code, message: `${code} 발생` } }),
  };
}

/** 요청의 Authorization 헤더를 꺼낸다. */
function bearerOf(call: unknown[]): string | undefined {
  const init = call[1] as { headers?: Record<string, string> };
  return init.headers?.Authorization;
}

beforeEach(() => {
  resetAuthClientState();
  mockStored = { access: "old-access", refresh: "old-refresh" };
});

describe("만료 토큰 재발급", () => {
  it("G6 — 만료면 재발급받아 원 요청을 새 토큰으로 1회 재시도한다", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(failure("UNAUTHORIZED", 401))
      .mockResolvedValueOnce(envelope({ accessToken: "new-access", refreshToken: "new-refresh" }))
      .mockResolvedValueOnce(envelope({ id: 42 }));

    const result = await authedRequest(BASE, "/reservation-requests/42", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ id: 42 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl.mock.calls[1][0]).toBe(`${BASE}/auth/refresh`);
    // 재시도는 새 토큰으로 나가야 한다 — 옛 토큰으로 다시 보내면 같은 401을 맞는다.
    expect(bearerOf(fetchImpl.mock.calls[0])).toBe("Bearer old-access");
    expect(bearerOf(fetchImpl.mock.calls[2])).toBe("Bearer new-access");
    // 회전이므로 refresh 토큰도 함께 갈아탄다.
    expect(mockStored).toEqual({ access: "new-access", refresh: "new-refresh" });
  });

  it("G6-b — 재발급받은 토큰으로도 401이면 더 시도하지 않는다", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(failure("UNAUTHORIZED", 401))
      .mockResolvedValueOnce(envelope({ accessToken: "new-access", refreshToken: "new-refresh" }))
      .mockResolvedValueOnce(failure("UNAUTHORIZED", 401));

    await expect(
      authedRequest(BASE, "/reservation-requests/42", {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(ApiRequestError);

    // 3회에서 멈춘다. 반복하면 무한 루프다.
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("G7 — 재발급이 실패하면 토큰을 비운다", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(failure("UNAUTHORIZED", 401))
      .mockResolvedValueOnce(failure("REFRESH_TOKEN_INVALID", 401));

    await expect(
      authedRequest(BASE, "/reservation-requests/42", {
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "REFRESH_TOKEN_INVALID" });

    // 남겨두면 다음 요청이 같은 왕복을 반복한다.
    expect(mockStored).toEqual({ access: null, refresh: null });
  });

  it("G7-b — 세션 만료 핸들러가 불려 가드가 반응할 수 있다", async () => {
    const onExpired = jest.fn();
    setSessionExpiredHandler(onExpired);

    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(failure("UNAUTHORIZED", 401))
      .mockResolvedValueOnce(failure("REFRESH_TOKEN_INVALID", 401));

    await expect(
      authedRequest(BASE, "/x", { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toMatchObject({ code: "REFRESH_TOKEN_INVALID" });

    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it("G8 — 동시에 만료를 맞은 요청 2건이 재발급을 한 번만 부른다", async () => {
    // 회전 방식이라 이게 깨지면 두 번째 재발급이 무효 토큰을 보내 세션이 통째로 끊긴다.
    const fetchImpl = jest.fn(async (url: string) => {
      if (url.endsWith("/auth/refresh")) {
        return envelope({ accessToken: "new-access", refreshToken: "new-refresh" });
      }
      // 아직 새 토큰이 저장되기 전이면 만료로 응답한다.
      return mockStored.access === "new-access"
        ? envelope({ ok: true })
        : failure("UNAUTHORIZED", 401);
    });

    await Promise.all([
      authedRequest(BASE, "/a", { fetchImpl: fetchImpl as unknown as typeof fetch }),
      authedRequest(BASE, "/b", { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ]);

    const refreshCalls = fetchImpl.mock.calls.filter(([url]) =>
      String(url).endsWith("/auth/refresh"),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("만료가 아닌 실패는 재발급을 부르지 않고 그대로 올린다", async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(failure("DOOR_NOT_YET_OPENABLE", 403));

    await expect(
      authedRequest(BASE, "/reservation-requests/42/door-open", {
        method: "POST",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "DOOR_NOT_YET_OPENABLE" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
