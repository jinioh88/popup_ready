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

function renderPanel(contract: Contract, opts: { isBrandParty?: boolean } = { isBrandParty: true }) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <SignaturePanel
            contract={contract}
            reservationId={1146}
            isBrandParty={opts.isBrandParty}
            onSign={vi.fn()}
          />
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

describe("SignaturePanel — 결제 링크는 당사자에게만 (2026-08-25 인수 발견)", () => {
  const signed: Contract = {
    ...BASE,
    status: "SIGNED",
    brandSignedAt: "2026-08-25T10:00:00+09:00",
    landlordSignedAt: "2026-08-25T11:00:00+09:00",
  };

  it("건물주에게는 결제 링크가 없다", () => {
    // 인수 테스트에서 사용자가 건물주로 이 버튼을 봤고, 이상하다고 느끼면서도 눌렀다.
    // 화면이 권했기 때문이다 — 서버는 403으로 막지만 그건 누른 뒤의 일이다.
    renderPanel(signed, { isBrandParty: false });

    expect(screen.queryByRole("link", { name: "결제하기" })).toBeNull();
  });

  it("건물주에게는 막힌 버튼 대신 다음에 무슨 일이 일어나는지를 말한다", () => {
    renderPanel(signed, { isBrandParty: false });

    expect(screen.getByText(/결제는 예약을 만든 브랜드가 진행합니다/)).toBeTruthy();
  });

  it("아직 모를 때는 링크도 안내도 띄우지 않는다", () => {
    // undefined는 "아니다"가 아니라 "모른다"다. 모르는 채 "브랜드가 진행합니다"를 띄우면
    // 정작 그 브랜드에게 거짓말이 된다.
    renderPanel(signed, {});

    expect(screen.queryByRole("link", { name: "결제하기" })).toBeNull();
    expect(screen.queryByText(/브랜드가 진행합니다/)).toBeNull();
  });

  it("서명 전에는 당사자라도 결제 링크가 없다", () => {
    // 두 판정은 AND다 — 당사자인 것과 결제할 시점인 것 둘 다여야 한다.
    renderPanel(BASE, { isBrandParty: true });

    expect(screen.queryByRole("link", { name: "결제하기" })).toBeNull();
  });
});
