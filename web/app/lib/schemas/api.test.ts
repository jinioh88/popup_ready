import { describe, expect, it } from "vitest";

import type { Schemas } from "../api/client";
import {
  fixtureListSchema,
  reservationRequestSchema,
  spaceSummaryListSchema,
  type Fixture,
  type ReservationRequest,
  type SpaceSummary,
} from "./api";

/**
 * 생성 타입(contracts/openapi.json 유래)과의 정합성을 컴파일 타임에 고정한다.
 * 백엔드가 필드명·타입을 바꾸면 타입 재생성 시점에 여기서 먼저 깨진다.
 *
 * 지금은 계약의 응답 스키마에 `required`가 없어 전 필드가 optional이다. 그래서 검사 방향은
 * "웹 스키마(더 엄격) → 생성 타입"만 성립한다. 백엔드의 required 명시 갱신이 오면
 * 반대 방향도 걸 수 있다.
 */
type Assert<T extends true> = T;

export type SpaceSummaryMatchesContract = Assert<
  SpaceSummary extends Schemas["SpaceSummaryResponse"] ? true : false
>;
export type FixtureMatchesContract = Assert<
  Fixture extends Schemas["FixtureResponse"] ? true : false
>;
export type ReservationRequestMatchesContract = Assert<
  ReservationRequest extends Schemas["ReservationRequestResponse"] ? true : false
>;

const SPACE: SpaceSummary = {
  id: 1,
  name: "성수 연무장길 팝업 공간",
  address: "서울 성동구 연무장길 25",
  location: { lat: 37.5445, lng: 127.0557 },
  dailyRent: 300_000,
  floorAreaM2: 42.5,
  maxPowerWatt: 5000,
};

const FIXTURE: Fixture = {
  id: 1,
  name: "이동식 행거",
  category: "HANGER",
  widthMm: 1000,
  depthMm: 500,
  powerWatt: 0,
  dailyRentalFee: 20_000,
  stockQty: 12,
};

describe("spaceSummaryListSchema", () => {
  it("계약대로 온 응답을 통과시킨다", () => {
    expect(spaceSummaryListSchema.parse([SPACE])).toEqual([SPACE]);
  });

  it("빈 목록도 유효하다 — 반경 안에 공실이 없을 수 있다", () => {
    expect(spaceSummaryListSchema.parse([])).toEqual([]);
  });

  it("주소가 null로 오면 거부한다 — 요약 카드가 깨지는 것을 경계에서 막는다", () => {
    expect(spaceSummaryListSchema.safeParse([{ ...SPACE, address: null }]).success).toBe(false);
  });

  it("위경도가 빠지면 거부한다 — 마커를 찍을 수 없다", () => {
    expect(spaceSummaryListSchema.safeParse([{ ...SPACE, location: undefined }]).success).toBe(
      false,
    );
  });
});

describe("fixtureListSchema", () => {
  it("계약대로 온 응답을 통과시킨다", () => {
    expect(fixtureListSchema.parse([FIXTURE])).toEqual([FIXTURE]);
  });

  it("계약에 없는 카테고리는 거부한다", () => {
    expect(fixtureListSchema.safeParse([{ ...FIXTURE, category: "SOFA" }]).success).toBe(false);
  });

  it("전력 0인 비전기 집기는 정상이다", () => {
    expect(fixtureListSchema.safeParse([{ ...FIXTURE, powerWatt: 0 }]).success).toBe(true);
  });

  it("규격이 소수로 오면 거부한다 — 점유 셀 계산이 mm 정수를 전제한다", () => {
    expect(fixtureListSchema.safeParse([{ ...FIXTURE, widthMm: 1000.5 }]).success).toBe(false);
  });
});

describe("reservationRequestSchema", () => {
  const RESERVATION: ReservationRequest = {
    id: 10,
    spaceId: 1,
    brandUserId: 2,
    startDate: "2026-09-01",
    endDate: "2026-09-03",
    status: "DRAFT",
    layout: { gridCols: 20, gridRows: 12, cellSizeMm: 500, items: [] },
    estimate: {
      days: 3,
      spaceRentTotal: 900_000,
      fixtureRentalTotal: 0,
      deposit: 90_000,
      totalAmount: 990_000,
    },
  };

  it("계약대로 온 응답을 통과시킨다", () => {
    expect(reservationRequestSchema.parse(RESERVATION)).toEqual(RESERVATION);
  });

  it("날짜가 ISO 타임스탬프로 오면 거부한다 — 계약상 yyyy-MM-dd다", () => {
    const wrong = { ...RESERVATION, startDate: "2026-09-01T00:00:00Z" };

    expect(reservationRequestSchema.safeParse(wrong).success).toBe(false);
  });

  it("견적 필드가 하나라도 빠지면 거부한다", () => {
    const wrong = { ...RESERVATION, estimate: { ...RESERVATION.estimate, deposit: undefined } };

    expect(reservationRequestSchema.safeParse(wrong).success).toBe(false);
  });

  it("계약에 없는 상태값은 거부한다", () => {
    expect(reservationRequestSchema.safeParse({ ...RESERVATION, status: "PAID" }).success).toBe(
      false,
    );
  });
});
