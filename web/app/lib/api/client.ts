import type { components } from "./schema";
import { isErrorCode, type ErrorCode } from "./error-codes";
import { clearSession, getAccessToken } from "./token";

/**
 * 공용 API 클라이언트.
 *
 * 응답 봉투(`{ data, error }`) 해석과 JWT 헤더 첨부를 여기 한 곳에 모은다 — 화면마다 흩어지면
 * 통합 시점에 봉투 처리가 갈라진다(web/CLAUDE.md 백엔드 연동 규약).
 */

export type Schemas = components["schemas"];

/** 봉투에서 페이로드 타입만 벗겨낸다. 생성 타입이 `T | null`로 나오므로 null을 걷어낸다. */
export type Unwrapped<Envelope> = Envelope extends { data?: infer Payload }
  ? NonNullable<Payload>
  : never;

/** 백엔드가 `application/json`으로만 응답하므로 base URL은 오리진만 다르다. */
const API_PREFIX = "/api/v1";

function baseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: QueryParams;
  /** JSON으로 직렬화해 보낼 본문. */
  body?: unknown;
  signal?: AbortSignal;
};

/** 서버가 봉투에 담아 보낸 실패. `code`로 분기한다 — 메시지 문자열로 분기하지 않는다. */
export class ApiRequestError extends Error {
  readonly code: ErrorCode | "UNKNOWN";
  readonly status: number;

  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code && isErrorCode(code) ? code : "UNKNOWN";
  }
}

function buildUrl(path: string, query?: QueryParams): string {
  const url = `${baseUrl()}${API_PREFIX}${path}`;

  if (!query) {
    return url;
  }

  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  }

  const queryString = search.toString();
  return queryString ? `${url}?${queryString}` : url;
}

/**
 * 요청을 보내고 봉투를 벗겨 `data`만 돌려준다.
 *
 * 실패(HTTP 오류 또는 `error` 채워짐)는 `ApiRequestError`로 던진다 — TanStack Query가
 * 이 예외를 그대로 받아 에러 상태로 다룬다.
 */
export async function apiRequest<Payload>(
  path: string,
  options: RequestOptions = {},
): Promise<Payload> {
  const { method = "GET", query, body, signal } = options;
  const token = getAccessToken();

  const headers = new Headers({ Accept: "application/json" });

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  const envelope = await readEnvelope(response);

  if (response.status === 401) {
    // Access 토큰만 쓰고 Refresh는 Sprint 2 범위다 — 401이면 이 토큰으로 할 수 있는 게 없다.
    // 그대로 두면 이후 모든 요청이 401로 되풀이되고 인증 가드도 통과한 것처럼 보인다.
    clearSession();
  }

  if (envelope?.error) {
    throw new ApiRequestError(
      response.status,
      envelope.error.code,
      envelope.error.message ?? "요청을 처리하지 못했습니다.",
    );
  }

  if (!response.ok) {
    // 봉투 없이 떨어진 실패(프록시·게이트웨이 등). 코드가 없으니 UNKNOWN으로 남긴다.
    throw new ApiRequestError(
      response.status,
      undefined,
      `요청이 실패했습니다 (${response.status})`,
    );
  }

  if (envelope === null || envelope.data === null || envelope.data === undefined) {
    throw new ApiRequestError(
      response.status,
      undefined,
      "성공 응답에 data가 없습니다 — 응답 봉투 규약 위반입니다.",
    );
  }

  return envelope.data as Payload;
}

type Envelope = {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
};

/** 본문이 비어 있거나 JSON이 아닐 수 있다(204, 프록시 오류 페이지 등). */
async function readEnvelope(response: Response): Promise<Envelope | null> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as Envelope;
  } catch {
    return null;
  }
}
