// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { SignaturePanel } from "./SignaturePanel";
import type { Contract } from "../../lib/schemas/contract";

const BASE: Contract = {
  id: 668,
  reservationRequestId: 1146,
  title: "단기 공간사용 제휴계약",
  templateVersion: "v1",
  clauses: [{ title: "제1조 (목적)", body: "본 계약은…" }],
  status: "PENDING",
  brandSignedAt: null,
  landlordSignedAt: null,
  contentHash: "abc123",
};

afterEach(cleanup);

function renderPanel(contract: Contract) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <SignaturePanel contract={contract} reservationId={1146} onSign={vi.fn()} />
        ),
      },
    ],
    { initialEntries: ["/"] },
  );

  render(<RouterProvider router={router} />);
}

describe("SignaturePanel — 서명 후 다음 걸음", () => {
  it("양측 서명이 끝나면 결제로 가는 길을 준다", () => {
    // 이 링크가 없으면 결제 화면에 갈 방법이 없다 — 라우트는 있어도 아무도 가리키지 않으면
    // 사용자는 URL을 직접 쳐야 한다.
    renderPanel({
      ...BASE,
      status: "SIGNED",
      brandSignedAt: "2026-08-23T10:00:00Z",
      landlordSignedAt: "2026-08-23T10:05:00Z",
    });

    expect(screen.getByRole("link", { name: "결제하기" }).getAttribute("href")).toBe(
      "/reservations/1146/payment",
    );
  });

  it("서명이 안 끝났으면 결제로 보내지 않는다", () => {
    // 서버도 CONTRACT_SIGNED부터 결제를 받는다 — 미리 보내면 400을 맞는다.
    renderPanel(BASE);

    expect(screen.queryByRole("link", { name: "결제하기" })).toBeNull();
    expect(screen.getByRole("button", { name: /서명하기/ })).toBeTruthy();
  });

  it("결제 링크는 계약 id가 아니라 예약 id를 쓴다", () => {
    // 계약 668 / 예약 1146 — 헷갈리면 404가 난다.
    renderPanel({
      ...BASE,
      status: "SIGNED",
      brandSignedAt: "2026-08-23T10:00:00Z",
      landlordSignedAt: "2026-08-23T10:05:00Z",
    });

    const href = screen.getByRole("link", { name: "결제하기" }).getAttribute("href");

    expect(href).toContain("1146");
    expect(href).not.toContain("668");
  });
});
