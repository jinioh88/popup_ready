import { apiRequest, ApiRequestError, type ApiRequestOptions } from "./client";
import { refreshTokens } from "./auth";
import { clearTokens, readAccessToken, readRefreshToken, saveTokens } from "../auth/token-storage";

/**
 * JWT를 실어 보내고, 만료면 **한 번** 재발급받아 재시도하는 래퍼.
 *
 * `client.ts`는 전송(봉투 벗기기)만 안다. 인증 수명주기는 여기에 모아 둔다.
 */

/**
 * 세션 만료 통지.
 *
 * 재발급까지 실패하면 저장소를 비우는 것만으로는 부족하다 — 화면은 여전히 인증 상태로
 * 남아 보호 화면을 계속 보여준다. 세션(AuthProvider)이 이 자리를 채워 가드가 반응하게 한다.
 */
type SessionExpiredHandler = () => void;
let onSessionExpired: SessionExpiredHandler | null = null;

export function setSessionExpiredHandler(handler: SessionExpiredHandler | null): void {
  onSessionExpired = handler;
}

/**
 * 진행 중인 재발급을 공유한다.
 *
 * **회전 방식이라 이 공유가 필수다.** 동시 요청 3건이 함께 만료를 맞으면 재발급도 3번 나가는데,
 * 첫 번째가 성공하는 순간 나머지 둘이 든 refresh 토큰은 무효가 된다 — 재사용 감지에 걸려
 * 멀쩡한 세션이 통째로 끊긴다.
 */
let inFlightRefresh: Promise<string> | null = null;

/** 테스트가 모듈 상태를 넘겨받지 않도록 초기화 지점을 열어 둔다. */
export function resetAuthClientState(): void {
  inFlightRefresh = null;
  onSessionExpired = null;
}

function isExpiredAccessToken(error: unknown): boolean {
  // 분기는 HTTP 상태가 아니라 code로 한다(계약 규약).
  return error instanceof ApiRequestError && error.code === "UNAUTHORIZED";
}

async function refreshOnce(baseUrl: string, fetchImpl?: typeof fetch): Promise<string> {
  if (!inFlightRefresh) {
    inFlightRefresh = (async () => {
      const refreshToken = await readRefreshToken();
      if (!refreshToken) {
        throw new ApiRequestError("REFRESH_TOKEN_INVALID", "저장된 재발급 토큰이 없다.", null);
      }

      const pair = await refreshTokens(baseUrl, { refreshToken }, { fetchImpl });
      await saveTokens(pair);
      return pair.accessToken;
    })();

    // 성공·실패 어느 쪽이든 다음 요청이 새로 시도할 수 있게 비운다.
    inFlightRefresh = inFlightRefresh.finally(() => {
      inFlightRefresh = null;
    });
  }

  return inFlightRefresh;
}

/**
 * 인증이 필요한 요청. 만료(`UNAUTHORIZED`)면 재발급 후 **정확히 1회** 재시도한다.
 *
 * 재시도를 1회로 못 박는다 — 재발급받은 토큰으로도 401이 오면 그건 만료가 아니라 권한
 * 문제이므로, 반복하면 무한 루프가 된다.
 */
export async function authedRequest(
  baseUrl: string,
  path: string,
  options: Omit<ApiRequestOptions, "token"> = {},
): Promise<unknown> {
  const token = await readAccessToken();

  try {
    return await apiRequest(baseUrl, path, { ...options, token });
  } catch (error) {
    if (!isExpiredAccessToken(error)) throw error;

    let freshToken: string;
    try {
      freshToken = await refreshOnce(baseUrl, options.fetchImpl);
    } catch (refreshError) {
      // 재발급이 실패하면 세션은 끝났다. 토큰을 남겨두면 다음 요청이 같은 왕복을 반복한다.
      await clearTokens();
      onSessionExpired?.();
      throw refreshError;
    }

    return apiRequest(baseUrl, path, { ...options, token: freshToken });
  }
}
