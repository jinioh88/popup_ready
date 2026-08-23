import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";
import type { ReactElement } from "react";

import ReservationListScreen from "../src/app/reservations/index";

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { hostUri: "192.168.0.10:8081" } },
}));

const mockFetchMyReservations = jest.fn();
jest.mock("../src/lib/api/reservations", () => ({
  ...jest.requireActual("../src/lib/api/reservations"),
  fetchMyReservations: () => mockFetchMyReservations(),
}));

function renderWithQuery(ui: ReactElement) {
  // gcTime을 남겨두면 캐시 정리 타이머가 열린 핸들로 남아 jest가 종료되지 않는다.
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/** 렌더 트리에서 특정 타입의 노드를 찾는다. */
function findNodes(node: unknown, type: string, found: unknown[] = []): unknown[] {
  if (!node || typeof node !== "object") return found;
  const n = node as { type?: string; children?: unknown[] };
  if (n.type === type) found.push(n);
  (n.children ?? []).forEach((child) => findNodes(child, type, found));
  return found;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("예약 목록 화면", () => {
  it("예약을 카드로 표시하고 상태를 한국어로 보여준다", async () => {
    mockFetchMyReservations.mockResolvedValue([
      { id: 531, startDate: "2026-08-23", endDate: "2026-09-06", status: "PAID" },
    ]);
    await renderWithQuery(<ReservationListScreen />);

    expect(await screen.findByText("예약 #531")).toBeTruthy();
    expect(screen.getByText("결제 완료")).toBeTruthy();
    expect(screen.getByText("2026-08-23 ~ 2026-09-06")).toBeTruthy();
  });

  // expo-router의 Link는 asChild가 없으면 children을 <Text>로 감싼다. 그 안에 <View>를
  // 넣으면 Text 안의 View가 되어 안드로이드에서 레이아웃이 무너진다 — 테스트는 통과하고
  // 기기에서만 깨지는 자리라, 구조 자체를 단언해 되돌아가지 못하게 한다.
  it("카드가 <Text> 안에 <View>를 넣지 않는다", async () => {
    mockFetchMyReservations.mockResolvedValue([
      { id: 531, startDate: "2026-08-23", endDate: "2026-09-06", status: "PAID" },
    ]);
    await renderWithQuery(<ReservationListScreen />);
    await screen.findByText("예약 #531");

    const texts = findNodes(screen.toJSON(), "Text");
    expect(texts.length).toBeGreaterThan(0);
    texts.forEach((text) => {
      expect(findNodes(text, "View")).toHaveLength(0);
    });
  });

  it("예약이 없으면 빈 상태를 알린다", async () => {
    mockFetchMyReservations.mockResolvedValue([]);
    await renderWithQuery(<ReservationListScreen />);

    expect(await screen.findByText("아직 예약이 없다.")).toBeTruthy();
  });

  it("실패를 조용히 빈 목록으로 보여주지 않는다", async () => {
    mockFetchMyReservations.mockRejectedValue(new Error("네트워크 실패"));
    await renderWithQuery(<ReservationListScreen />);

    // 빈 목록과 실패는 다른 상태다. 같게 보이면 현장에서 원인을 못 찾는다.
    expect(await screen.findByText(/불러오지 못했다/)).toBeTruthy();
  });
});
