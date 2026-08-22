import { describe, expect, it } from "vitest";

import type { Schemas } from "../api/client";
import { reservationPeriodSchema, type ReservationPeriod } from "./reservation";

/** 기간 입력이 계약 요청 DTO의 날짜 필드와 어긋나지 않는지 컴파일 타임에 고정한다. */
type Assert<T extends true> = T;
type PeriodFields = Pick<Schemas["CreateReservationRequest"], "startDate" | "endDate">;

export type PeriodMatchesContract = Assert<ReservationPeriod extends PeriodFields ? true : false>;

describe("reservationPeriodSchema", () => {
  const valid: ReservationPeriod = { startDate: "2026-09-01", endDate: "2026-09-03" };

  it("계약 표기(yyyy-MM-dd)를 통과시킨다", () => {
    expect(reservationPeriodSchema.parse(valid)).toEqual(valid);
  });

  it("하루짜리 팝업도 유효하다 — 시작일과 종료일이 같아도 된다", () => {
    expect(
      reservationPeriodSchema.safeParse({ startDate: "2026-09-01", endDate: "2026-09-01" }).success,
    ).toBe(true);
  });

  it("종료일이 시작일보다 이르면 거부하고 종료일 필드에 사유를 붙인다", () => {
    const result = reservationPeriodSchema.safeParse({
      startDate: "2026-09-03",
      endDate: "2026-09-01",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(["endDate"]);
  });

  it("해를 넘겨도 사전순 비교가 날짜 비교와 어긋나지 않는다", () => {
    expect(
      reservationPeriodSchema.safeParse({ startDate: "2026-12-30", endDate: "2027-01-02" }).success,
    ).toBe(true);
  });

  it("날짜를 고르지 않으면 거부한다", () => {
    expect(reservationPeriodSchema.safeParse({ startDate: "", endDate: "" }).success).toBe(false);
  });

  it("ISO 타임스탬프는 거부한다 — 계약 표기가 아니다", () => {
    const result = reservationPeriodSchema.safeParse({
      startDate: "2026-09-01T00:00:00Z",
      endDate: "2026-09-03",
    });

    expect(result.success).toBe(false);
  });
});
