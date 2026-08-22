import { describe, expect, it } from "vitest";

import { estimateReservation, rentalDays } from "./estimate";

describe("rentalDays", () => {
  it("시작일과 종료일이 같으면 1일이다", () => {
    expect(rentalDays("2026-09-01", "2026-09-01")).toBe(1);
  });

  it("시작일·종료일을 모두 포함해 센다", () => {
    expect(rentalDays("2026-09-01", "2026-09-03")).toBe(3);
  });

  it("월을 넘겨도 정확히 센다", () => {
    expect(rentalDays("2026-08-30", "2026-09-02")).toBe(4);
  });

  it("서머타임이 있는 지역 설정에서도 하루가 밀리지 않는다 (UTC 기준 계산)", () => {
    expect(rentalDays("2026-03-01", "2026-03-31")).toBe(31);
  });

  it("종료일이 시작일보다 이르면 0이다", () => {
    expect(rentalDays("2026-09-03", "2026-09-01")).toBe(0);
  });

  it("날짜 형식이 아니면 0이다", () => {
    expect(rentalDays("어제", "2026-09-01")).toBe(0);
  });
});

describe("estimateReservation", () => {
  const base = {
    startDate: "2026-09-01",
    endDate: "2026-09-03",
    dailyRent: 300_000,
    depositRate: 0.1,
  };

  it("일수 × (공간 대여료 + Σ집기 렌털료) + 보증금으로 합산한다", () => {
    const estimate = estimateReservation({
      ...base,
      fixtures: [{ dailyRentalFee: 20_000 }, { dailyRentalFee: 30_000 }],
    });

    // 3일 × 300,000 = 900,000 / 3일 × 50,000 = 150,000 / 보증금 = 1,050,000 × 10%
    expect(estimate).toEqual({
      days: 3,
      spaceRentTotal: 900_000,
      fixtureRentalTotal: 150_000,
      deposit: 105_000,
      totalAmount: 1_155_000,
    });
  });

  it("집기를 하나도 배치하지 않아도 공간 대여료만으로 계산된다", () => {
    const estimate = estimateReservation({ ...base, fixtures: [] });

    expect(estimate.fixtureRentalTotal).toBe(0);
    expect(estimate.totalAmount).toBe(990_000);
  });

  it("같은 집기를 여러 개 놓으면 그 수만큼 합산한다", () => {
    const estimate = estimateReservation({
      ...base,
      fixtures: [{ dailyRentalFee: 20_000 }, { dailyRentalFee: 20_000 }],
    });

    expect(estimate.fixtureRentalTotal).toBe(120_000);
  });

  it("보증금은 원 단위로 반올림한다", () => {
    const estimate = estimateReservation({
      startDate: "2026-09-01",
      endDate: "2026-09-01",
      dailyRent: 12_345,
      depositRate: 0.1,
      fixtures: [],
    });

    expect(estimate.deposit).toBe(1235);
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
