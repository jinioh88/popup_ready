// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";

import ContractRoute from "./contract";
import type { Contract } from "../lib/schemas/contract";

/**
 * 계약 라우트 조립 테스트 (§8.9).
 *
 * **판정이 여기 있으므로 테스트도 여기 있다.** 결함은 "계약이 `SIGNED`인가"만 묻고
 * "이 사람이 결제할 사람인가"를 묻지 않은 것이었고, 그 두 번째 질문의 답은 예약의
 * `brandUserId`에 있다 — `SignaturePanel`은 계약만 알아서 원리적으로 알 수 없다.
 */

const useContract = vi.fn();
const useSignContract = vi.fn();
const useReservation = vi.fn();
const getCurrentUser = vi.fn();

vi.mock("../features/contract/queries", () => ({
  useContract: (...a: unknown[]) => useContract(...a),
  useSignContract: (...a: unknown[]) => useSignContract(...a),
}));

vi.mock("../features/payment/queries", () => ({
  useReservation: (...a: unknown[]) => useReservation(...a),
}));

vi.mock("../lib/api/token", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

afterEach(cleanup);

const BRAND_USER_ID = 7;
const LANDLORD_USER_ID = 12;

const SIGNED_CONTRACT: Contract = {
  id: 668,
  reservationRequestId: 1156,
  title: "단기 공간사용 제휴계약",
  templateVersion: "v1",
  clauses: [{ title: "제1조 (목적)", body: "본 계약은…" }],
  status: "SIGNED",
  brandSignedAt: "2026-08-25T10:00:00+09:00",
  landlordSignedAt: "2026-08-25T11:00:00+09:00",
  contentHash: "abc123",
};

/** 서명이 끝난 계약을 `viewerId`로 보고 있는 화면. */
function viewContract(viewerId: number | null, reservationLoaded = true) {
  useContract.mockReturnValue({ isPending: false, isError: false, data: SIGNED_CONTRACT });
  useReservation.mockReturnValue({
    data: reservationLoaded ? { id: 1156, brandUserId: BRAND_USER_ID } : undefined,
  });
  getCurrentUser.mockReturnValue(
    viewerId === null ? null : { id: viewerId, email: "u@x.com", name: "사용자", role: "BRAND" },
  );

  const Stub = createRoutesStub([
    { path: "/reservations/:reservationId/contract", Component: ContractRoute },
  ]);

  render(<Stub initialEntries={["/reservations/1156/contract"]} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  useSignContract.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false });
});

describe("계약 라우트 — 결제 링크를 누구에게 보여주는가", () => {
  it("예약을 만든 브랜드에게는 결제 링크가 있다", () => {
    viewContract(BRAND_USER_ID);

    expect(screen.getByRole("link", { name: "결제하기" })).toBeTruthy();
  });

  it("건물주에게는 결제 링크가 없다", () => {
    // 인수 테스트에서 사용자가 건물주로 서명한 직후 이 버튼을 봤다. C-4 절차가
    // "브랜드로 서명 → 로그아웃 → 건물주로 서명"을 시키므로 정면으로 밟게 된다.
    viewContract(LANDLORD_USER_ID);

    expect(screen.queryByRole("link", { name: "결제하기" })).toBeNull();
    expect(screen.getByText(/결제는 예약을 만든 브랜드가 진행합니다/)).toBeTruthy();
  });

  it("예약을 아직 못 받았으면 링크도 안내도 없다", () => {
    // "모른다"를 "아니다"로 처리하면, 정작 결제해야 할 브랜드에게 "브랜드가 진행합니다"라고
    // 말하는 순간이 생긴다.
    viewContract(BRAND_USER_ID, false);

    expect(screen.queryByRole("link", { name: "결제하기" })).toBeNull();
    expect(screen.queryByText(/브랜드가 진행합니다/)).toBeNull();
  });

  it("로그인 정보가 없으면 링크를 띄우지 않는다", () => {
    viewContract(null);

    expect(screen.queryByRole("link", { name: "결제하기" })).toBeNull();
  });
});
