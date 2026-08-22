import type { components } from "./schema";

/** 백엔드가 상수로 관리하는 에러 코드. 분기는 message가 아니라 이 값으로 한다. */
export type ApiErrorCode = NonNullable<components["schemas"]["ApiError"]["code"]>;

/** `{data, error}` 봉투의 error가 채워졌거나 통신 자체가 실패했을 때 던진다. */
export class ApiRequestError extends Error {
  readonly code: ApiErrorCode;
  readonly httpStatus: number | null;

  constructor(code: ApiErrorCode, message: string, httpStatus: number | null) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

type Envelope = {
  data?: unknown;
  error?: { code?: ApiErrorCode; message?: string } | null;
};

export type ApiRequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  /** JWT Access 토큰. 있으면 Bearer로 싣는다. */
  token?: string | null;
  /** 테스트에서 주입한다. 기본값은 전역 fetch. */
  fetchImpl?: typeof fetch;
};

/**
 * `{data, error}` 봉투를 벗겨 data만 돌려준다. 실패는 예외로 올린다.
 *
 * **상태 코드가 아니라 error.code로 분기한다.** 현재 스펙에 문서화된 실패는 400·500뿐이고
 * 인증이 붙는 Phase 2에서 401이 추가되므로(지시서 §2.2), 상태 코드에 로직을 매면 그때 깨진다.
 */
export async function apiRequest(
  baseUrl: string,
  path: string,
  options: ApiRequestOptions = {},
): Promise<unknown> {
  const { method = "GET", body, token, fetchImpl = fetch } = options;

  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (cause) {
    // 네트워크 도달 실패 — 서버가 안 떠 있거나 주소가 틀렸다. 봉투가 아예 없다.
    throw new ApiRequestError(
      "INTERNAL_ERROR",
      cause instanceof Error ? cause.message : "네트워크 요청에 실패했다",
      null,
    );
  }

  let envelope: Envelope;
  try {
    envelope = (await response.json()) as Envelope;
  } catch {
    throw new ApiRequestError(
      "INTERNAL_ERROR",
      `응답을 JSON으로 읽지 못했다 (HTTP ${response.status})`,
      response.status,
    );
  }

  if (envelope.error) {
    throw new ApiRequestError(
      envelope.error.code ?? "INTERNAL_ERROR",
      envelope.error.message ?? "요청이 실패했다",
      response.status,
    );
  }

  // 봉투 규약상 성공이면 error가 null이다. 그런데 HTTP가 실패면 규약이 깨진 것이므로 숨기지 않는다.
  if (!response.ok) {
    throw new ApiRequestError(
      "INTERNAL_ERROR",
      `error 없이 실패 응답이 왔다 (HTTP ${response.status})`,
      response.status,
    );
  }

  return envelope.data;
}
