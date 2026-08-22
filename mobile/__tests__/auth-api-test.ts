import { login } from "../src/lib/api/auth";

const BASE = "http://192.168.0.10:8080/api/v1";

const VALID_USER = { id: 1, email: "brand@popupready.com", name: "김브랜드", role: "BRAND" };

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("login", () => {
  it("계약대로 온 응답을 파싱해 토큰과 사용자를 돌려준다", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: { accessToken: "jwt-abc", user: VALID_USER }, error: null }),
      );

    await expect(
      login(BASE, { email: "brand@popupready.com", password: "pw" }, { fetchImpl }),
    ).resolves.toEqual({ accessToken: "jwt-abc", user: VALID_USER });
    expect(fetchImpl.mock.calls[0][0]).toBe(`${BASE}/auth/login`);
  });

  // 생성 타입은 모든 필드가 optional이라 tsc가 못 잡는다. 여기서 막지 않으면
  // 토큰 없는 "로그인 성공"이 되어 이후 요청이 전부 조용히 죽는다.
  it("accessToken이 없으면 성공으로 처리하지 않는다", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse({ data: { user: VALID_USER }, error: null }));

    await expect(
      login(BASE, { email: "a@b.com", password: "pw" }, { fetchImpl }),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });

  it("accessToken이 빈 문자열이어도 거른다", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ data: { accessToken: "", user: VALID_USER }, error: null }),
      );

    await expect(
      login(BASE, { email: "a@b.com", password: "pw" }, { fetchImpl }),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });

  it("계약에 없는 role이 오면 거른다", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        data: { accessToken: "jwt-abc", user: { ...VALID_USER, role: "SUPERUSER" } },
        error: null,
      }),
    );

    await expect(
      login(BASE, { email: "a@b.com", password: "pw" }, { fetchImpl }),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
    });
  });

  it("서버 실패 봉투는 에러 코드를 살려 올린다", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { data: null, error: { code: "INVALID_CREDENTIALS", message: "자격 증명 오류" } },
          400,
        ),
      );

    await expect(
      login(BASE, { email: "a@b.com", password: "pw" }, { fetchImpl }),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
  });
});
