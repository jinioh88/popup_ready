import { afterEach, describe, expect, it, vi } from "vitest";

import { ensureContract } from "./contracts";
import { ApiRequestError } from "./client";

/**
 * `ensureContract`의 재진입 흐름(GET → 404면 POST → 409면 GET 폴백)을 고정한다.
 *
 * 이 순서가 틀어지면 증상이 고약하다 — 열람하려던 사용자가 계약을 새로 만들거나(POST 선행),
 * 이미 서명된 계약을 못 여는(409에서 그냥 실패) 형태로 나온다. 둘 다 화면에서는
 * "계약을 불러올 수 없습니다"로만 보여서 원인이 가려진다.
 */

const CONTRACT = {
  id: 1,
  reservationRequestId: 7,
  title: "단기 공간사용 제휴계약",
  templateVersion: "v1",
  clauses: [{ title: "제1조 (목적)", body: "본 계약은 …" }],
  contentHash: "3f2b7c1d",
  brandSignedAt: null,
  landlordSignedAt: null,
  status: "PENDING",
};

type Call = { status: number; body: unknown };

/** 호출 순서대로 응답을 돌려주는 fetch 스텁. 어떤 메서드로 무엇을 불렀는지도 기록한다. */
function stubFetch(...responses: Call[]) {
  const calls: { method: string; url: string }[] = [];
  let index = 0;

  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      calls.push({ method: init?.method ?? "GET", url: String(url) });
      const next = responses[index++];

      if (!next) {
        throw new Error(`예상보다 많은 요청: ${init?.method ?? "GET"} ${url}`);
      }

      return Promise.resolve(
        new Response(JSON.stringify(next.body), {
          status: next.status,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }),
  );

  return calls;
}

const ok = (data: unknown): Call => ({ status: 200, body: { data, error: null } });
const created = (data: unknown): Call => ({ status: 201, body: { data, error: null } });
const fail = (status: number, code: string): Call => ({
  status,
  body: { data: null, error: { code, message: `테스트 ${code}` } },
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ensureContract", () => {
  it("계약이 있으면 GET 한 번으로 끝난다 — 생성 API를 부르지 않는다", async () => {
    const calls = stubFetch(ok(CONTRACT));

    await expect(ensureContract(7)).resolves.toMatchObject({ id: 1 });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("GET");
  });

  it("404면 생성한다", async () => {
    const calls = stubFetch(fail(404, "CONTRACT_NOT_FOUND"), created(CONTRACT));

    await expect(ensureContract(7)).resolves.toMatchObject({ id: 1 });
    expect(calls.map((c) => c.method)).toEqual(["GET", "POST"]);
  });

  it("생성이 409면(경쟁 상황) 다시 읽어 온다", async () => {
    const calls = stubFetch(
      fail(404, "CONTRACT_NOT_FOUND"),
      fail(409, "CONTRACT_ALREADY_EXISTS"),
      ok(CONTRACT),
    );

    await expect(ensureContract(7)).resolves.toMatchObject({ id: 1 });
    expect(calls.map((c) => c.method)).toEqual(["GET", "POST", "GET"]);
  });

  it("404가 아닌 실패는 생성으로 넘어가지 않고 그대로 던진다", async () => {
    // 401을 404처럼 다루면 로그인이 풀린 사용자가 계약을 새로 만드는 요청을 쏘게 된다.
    const calls = stubFetch(fail(401, "UNAUTHORIZED"));

    await expect(ensureContract(7)).rejects.toBeInstanceOf(ApiRequestError);
    expect(calls).toHaveLength(1);
  });

  it("생성이 409 외의 이유로 실패하면 폴백하지 않는다", async () => {
    const calls = stubFetch(fail(404, "CONTRACT_NOT_FOUND"), fail(400, "VALIDATION_FAILED"));

    await expect(ensureContract(7)).rejects.toBeInstanceOf(ApiRequestError);
    expect(calls.map((c) => c.method)).toEqual(["GET", "POST"]);
  });

  it("같은 404라도 사유가 다르면 생성하지 않는다", async () => {
    // 상태 코드로 묶으면 "예약 요청 자체가 없다"까지 '계약이 없으니 만들자'로 빨려 들어간다.
    const calls = stubFetch(fail(404, "RESERVATION_REQUEST_NOT_FOUND"));

    await expect(ensureContract(7)).rejects.toBeInstanceOf(ApiRequestError);
    expect(calls).toHaveLength(1);
  });

  it("같은 409라도 사유가 다르면 폴백하지 않는다", async () => {
    const calls = stubFetch(
      fail(404, "CONTRACT_NOT_FOUND"),
      fail(409, "CONTRACT_ALREADY_SIGNED"),
    );

    await expect(ensureContract(7)).rejects.toBeInstanceOf(ApiRequestError);
    expect(calls.map((c) => c.method)).toEqual(["GET", "POST"]);
  });

  it("조항이 빈 계약은 파싱 단계에서 거부한다", async () => {
    stubFetch(ok({ ...CONTRACT, clauses: [] }));

    await expect(ensureContract(7)).rejects.toThrow();
  });
});
