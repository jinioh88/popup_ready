import { describe, expect, it } from "vitest";

import type { Schemas } from "../api/client";
import { maxEndDate, reservationPeriodSchema, type ReservationPeriod } from "./reservation";

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

describe("사용 기간 30일 상한 (법률 세이프가드)", () => {
  // 백엔드 ReservationPeriod.MAX_DAYS와 같은 경계를 쓴다 — 한쪽만 바뀌면 정상 기간이 400으로 거절된다.
  const cases: [string, string, string, boolean][] = [
    ["당일 사용(1일)", "2026-09-01", "2026-09-01", true],
    ["14일", "2026-09-01", "2026-09-14", true],
    ["경계 정확히 30일", "2026-09-01", "2026-09-30", true],
    ["경계 1일 초과(31일)", "2026-09-01", "2026-10-01", false],
    ["크게 초과(60일)", "2026-09-01", "2026-10-30", false],
    ["윤달 걸친 30일", "2028-02-01", "2028-03-01", true],
    ["윤달 걸친 31일", "2028-02-01", "2028-03-02", false],
  ];

  it.each(cases)("%s: %s ~ %s", (_label, startDate, endDate, expected) => {
    expect(reservationPeriodSchema.safeParse({ startDate, endDate }).success).toBe(expected);
  });

  it("상한 초과는 endDate에 안내가 붙는다", () => {
    const result = reservationPeriodSchema.safeParse({
      startDate: "2026-09-01",
      endDate: "2026-10-01",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path[0] === "endDate");
      expect(issue?.message).toContain("최대 30일");
    }
  });

  it("순서가 뒤집힌 경우 상한 안내가 중복으로 붙지 않는다", () => {
    const result = reservationPeriodSchema.safeParse({
      startDate: "2026-10-01",
      endDate: "2026-09-01",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.filter((i) => i.path[0] === "endDate")).toHaveLength(1);
    }
  });
});

describe("maxEndDate", () => {
  it("시작일 + 29일이 마지막 선택 가능일이다 (양끝 포함 30일)", () => {
    expect(maxEndDate("2026-09-01")).toBe("2026-09-30");
  });

  it("월·연 경계를 넘어간다", () => {
    expect(maxEndDate("2026-12-20")).toBe("2027-01-18");
  });

  it("윤달을 건너뛰지 않는다", () => {
    expect(maxEndDate("2028-02-01")).toBe("2028-03-01");
  });

  it("스키마 판정과 경계가 일치한다", () => {
    const startDate = "2026-09-01";
    const last = maxEndDate(startDate)!;
    const dayAfter = new Date(Date.parse(`${last}T00:00:00Z`) + 86_400_000)
      .toISOString()
      .slice(0, 10);

    expect(reservationPeriodSchema.safeParse({ startDate, endDate: last }).success).toBe(true);
    expect(reservationPeriodSchema.safeParse({ startDate, endDate: dayAfter }).success).toBe(false);
  });

  it("날짜가 아니면 상한을 만들지 않는다", () => {
    expect(maxEndDate("")).toBeUndefined();
  });
});
