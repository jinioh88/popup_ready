import { describe, expect, it } from "vitest";

import { contractSchema } from "./contract";

/**
 * 계약 응답 경계 검증 — **핵심 3종 규약의 PM 승인 예외**라 이 스키마가 무엇을 막는지 고정해 둔다.
 * 훼손된 계약이 조용히 렌더되면 사용자가 실제와 다른 문서에 서명하게 된다.
 */

const VALID = {
  id: 1,
  reservationRequestId: 7,
  title: "단기 공간사용 제휴계약",
  templateVersion: "v1",
  clauses: [{ title: "제1조 (목적)", body: "본 계약은 팝업스토어 단기 운영을 목적으로 한다." }],
  contentHash: "3f2b7c1d9a4e5f60",
  brandSignedAt: null,
  landlordSignedAt: null,
  status: "PENDING",
};

/** 필드 하나를 뺀 응답을 만든다 — 서버가 키를 통째로 빠뜨린 상황. */
function omit(key: keyof typeof VALID): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...VALID };
  delete copy[key];
  return copy;
}

describe("contractSchema", () => {
  it("정상 계약을 통과시킨다", () => {
    expect(contractSchema.safeParse(VALID).success).toBe(true);
  });

  it("서명 완료 계약도 통과시킨다", () => {
    const signed = {
      ...VALID,
      brandSignedAt: "2026-08-22T05:12:31Z",
      landlordSignedAt: "2026-08-22T06:40:02Z",
      status: "SIGNED",
    };

    expect(contractSchema.safeParse(signed).success).toBe(true);
  });

  it("오프셋 표기 타임스탬프도 받는다", () => {
    // 규약은 Z 표기지만, 같은 시각의 다른 표기 때문에 화면이 잠기면 안 된다.
    const parsed = contractSchema.safeParse({ ...VALID, brandSignedAt: "2026-08-22T14:12:31+09:00" });
    expect(parsed.success).toBe(true);
  });

  it("마이크로초 정밀도 타임스탬프를 받는다", () => {
    // 백엔드가 실제로 보내는 형태다(Phase 5 실측) — 여기서 막히면 서명 완료 계약을 못 연다.
    const parsed = contractSchema.safeParse({
      ...VALID,
      brandSignedAt: "2026-08-23T00:57:27.075412Z",
      status: "SIGNED",
    });
    expect(parsed.success).toBe(true);
  });

  it("조항이 비면 거부한다", () => {
    expect(contractSchema.safeParse({ ...VALID, clauses: [] }).success).toBe(false);
  });

  it("조항 본문이 빈 문자열이면 거부한다", () => {
    // 제목만 있고 내용이 없는 조항은 '내용 없는 계약서'다 — 화면 버그가 아니라 문서 훼손이다.
    const empty = { ...VALID, clauses: [{ title: "제1조 (목적)", body: "" }] };
    expect(contractSchema.safeParse(empty).success).toBe(false);
  });

  it("무결성 해시가 없으면 거부한다", () => {
    expect(contractSchema.safeParse(omit("contentHash")).success).toBe(false);
  });

  it("서명 시각 키가 아예 없으면 거부한다", () => {
    // 계약상 required + nullable이다 — "키는 항상 있고 값만 null"(sprint1.md §2.2).
    expect(contractSchema.safeParse(omit("brandSignedAt")).success).toBe(false);
  });

  it("알 수 없는 상태값은 거부한다", () => {
    expect(contractSchema.safeParse({ ...VALID, status: "DRAFT" }).success).toBe(false);
  });
});
