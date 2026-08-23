import { describe, expect, it } from "vitest";

import { estimateReservation } from "./estimate";

describe("estimateReservation", () => {
  const base = {
    startDate: "2026-09-01",
    endDate: "2026-09-03",
    dailyRent: 300_000,
    depositRate: 0.1,
  };

  it("일수 × 공간 대여료 + 일수 × Σ집기 렌털료 + 보증금으로 합산한다", () => {
    const estimate = estimateReservation({
      ...base,
      fixtures: [{ dailyRentalFee: 20_000 }, { dailyRentalFee: 30_000 }],
    });

    // 3일 × 300,000 = 900,000 / 3일 × 50,000 = 150,000 / 보증금 = 900,000 × 10%
    expect(estimate).toEqual({
      days: 3,
      spaceRentTotal: 900_000,
      fixtureRentalTotal: 150_000,
      deposit: 90_000,
      totalAmount: 1_140_000,
    });
  });

  it("보증금 기준은 공간 대여료다 — 집기를 아무리 많이 놓아도 보증금은 그대로다", () => {
    const withoutFixtures = estimateReservation({ ...base, fixtures: [] });
    const withManyFixtures = estimateReservation({
      ...base,
      fixtures: Array.from({ length: 10 }, () => ({ dailyRentalFee: 40_000 })),
    });

    expect(withManyFixtures.deposit).toBe(withoutFixtures.deposit);
  });

  it("스프린트 문서 §2.2의 검증 예시와 일치한다", () => {
    // 14일 × 450,000 = 6,300,000 / 집기 420,000 / 보증금 630,000 / 합계 7,350,000
    const estimate = estimateReservation({
      startDate: "2026-09-01",
      endDate: "2026-09-14",
      dailyRent: 450_000,
      depositRate: 0.1,
      fixtures: [{ dailyRentalFee: 30_000 }],
    });

    expect(estimate).toEqual({
      days: 14,
      spaceRentTotal: 6_300_000,
      fixtureRentalTotal: 420_000,
      deposit: 630_000,
      totalAmount: 7_350_000,
    });
  });

  it("집기를 하나도 배치하지 않아도 공간 대여료만으로 계산된다", () => {
    const estimate = estimateReservation({ ...base, fixtures: [] });

    expect(estimate.fixtureRentalTotal).toBe(0);
    expect(estimate.deposit).toBe(90_000);
    expect(estimate.totalAmount).toBe(990_000);
  });

  it("같은 집기를 여러 개 놓으면 그 수만큼 합산한다", () => {
    const estimate = estimateReservation({
      ...base,
      fixtures: [{ dailyRentalFee: 20_000 }, { dailyRentalFee: 20_000 }],
    });

    expect(estimate.fixtureRentalTotal).toBe(120_000);
  });

  it("보증금은 원 단위 HALF_UP으로 맺는다 — 0.5는 올린다", () => {
    const estimate = estimateReservation({
      startDate: "2026-09-01",
      endDate: "2026-09-01",
      dailyRent: 12_345,
      depositRate: 0.1,
      fixtures: [],
    });

    expect(estimate.deposit).toBe(1235);
  });

  it("이진 부동소수로 떨어지지 않는 비율에서도 십진 기준과 어긋나지 않는다", () => {
    // 0.07 × 1,050,150 = 73,510.5 → HALF_UP이면 73,511
    const estimate = estimateReservation({
      startDate: "2026-09-01",
      endDate: "2026-09-01",
      dailyRent: 1_050_150,
      depositRate: 0.07,
      fixtures: [],
    });

    expect(estimate.deposit).toBe(73_511);
  });

  it("기간이 뒤집혀 있으면 0일로 보고 보증금까지 0이 된다", () => {
    const estimate = estimateReservation({
      ...base,
      startDate: "2026-09-03",
      endDate: "2026-09-01",
      fixtures: [{ dailyRentalFee: 20_000 }],
    });

    expect(estimate).toEqual({
      days: 0,
      spaceRentTotal: 0,
      fixtureRentalTotal: 0,
      deposit: 0,
      totalAmount: 0,
    });
  });
});
