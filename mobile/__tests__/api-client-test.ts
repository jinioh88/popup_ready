import { apiRequest, ApiRequestError } from "../src/lib/api/client";

const BASE = "http://192.168.0.10:8080/api/v1";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("apiRequest", () => {
  it("성공 봉투에서 data만 벗겨 돌려준다", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ data: { id: 1 }, error: null }));

    await expect(apiRequest(BASE, "/spaces", { fetchImpl })).resolves.toEqual({ id: 1 });
  });

  it("토큰이 있으면 Bearer 헤더를 싣고, 없으면 싣지 않는다", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ data: null, error: null }));

    await apiRequest(BASE, "/spaces", { fetchImpl, token: "jwt-abc" });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe("Bearer jwt-abc");

    await apiRequest(BASE, "/spaces", { fetchImpl });
    expect(fetchImpl.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });

  it("POST 본문을 JSON으로 직렬화하고 Content-Type을 붙인다", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ data: {}, error: null }));

    await apiRequest(BASE, "/auth/login", {
      method: "POST",
      body: { email: "a@b.com", password: "pw" },
      fetchImpl,
    });

    const init = fetchImpl.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ email: "a@b.com", password: "pw" });
  });

  // 상태 코드가 아니라 error.code로 분기한다 — Phase 2에서 401이 추가돼도 안 깨지게.
  it("error 봉투를 코드까지 살려 예외로 올린다", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { data: null, error: { code: "INVALID_CREDENTIALS", message: "자격 증명 오류" } },
          400,
        ),
      );

    await expect(
      apiRequest(BASE, "/auth/login", { method: "POST", fetchImpl }),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      message: "자격 증명 오류",
      httpStatus: 400,
    });
  });

  it("네트워크 도달 실패는 INTERNAL_ERROR로 감싸고 상태 코드는 null이다", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("Network request failed"));

    const error: unknown = await apiRequest(BASE, "/spaces", { fetchImpl }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    const apiError = error as ApiRequestError;
    expect(apiError.code).toBe("INTERNAL_ERROR");
    expect(apiError.httpStatus).toBeNull();
  });

  it("JSON이 아닌 응답을 성공으로 넘기지 않는다", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("Unexpected token < in JSON");
      },
    } as unknown as Response);

    await expect(apiRequest(BASE, "/spaces", { fetchImpl })).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      httpStatus: 502,
    });
  });

  // 봉투 규약이 깨진 경우다. data가 비어 있다고 성공으로 처리하면 원인이 사라진다.
  it("error 없이 실패 상태로 오면 성공으로 처리하지 않는다", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ data: null, error: null }, 500));

    await expect(apiRequest(BASE, "/spaces", { fetchImpl })).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      httpStatus: 500,
    });
  });
});
