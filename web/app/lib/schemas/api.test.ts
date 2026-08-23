import { describe, expect, it } from "vitest";

import type { Schemas } from "../api/client";
import {
  fixtureListSchema,
  reservationRequestSchema,
  spaceSummaryListSchema,
  type EstimateResponse,
  type Fixture,
  type ReservationRequest,
  type SpaceSummary,
} from "./api";

/**
 * 생성 타입(contracts/openapi.json 유래)과의 정합성을 컴파일 타임에 고정한다.
 * 백엔드가 필드명·타입을 바꾸면 타입 재생성 시점에 여기서 먼저 깨진다.
 *
 * 계약에 required가 명시된 뒤로 **양방향**을 걸 수 있게 됐다. 단 예약 요청 응답만은
 * 한 방향이다 — 계약의 `rotation`이 정수 범위(0~270)로만 표기되기 때문이다
 * (springdoc 제약, sprint1.md §2.2 표기 규약). 웹은 `0|90|180|270`으로 더 좁게 잡는다.
 */
type Assert<T extends true> = T;
type MutuallyAssignable<A, B> = A extends B ? (B extends A ? true : false) : false;

export type SpaceSummaryMatchesContract = Assert<
  MutuallyAssignable<SpaceSummary, Schemas["SpaceSummaryResponse"]>
>;
export type FixtureMatchesContract = Assert<
  MutuallyAssignable<Fixture, Schemas["FixtureResponse"]>
>;
export type EstimateMatchesContract = Assert<
  MutuallyAssignable<EstimateResponse, Schemas["EstimateResponse"]>
>;
export type ReservationRequestMatchesContract = Assert<
  ReservationRequest extends Schemas["ReservationRequestResponse"] ? true : false
>;

/**
 * **상태만은 양방향으로 잠근다.**
 *
 * 위의 객체 단언은 한 방향(웹 ⊆ 계약)이라 **계약이 넓어지는 것을 못 잡는다** — 웹이 3종만
 * 알고 계약이 6종이어도 3종은 여전히 6종에 대입되므로 `tsc`가 통과한다. 실제로 2026-08-23
 * `PAYMENT_PENDING`·`PAID`·`CANCELLED`가 추가됐을 때 컴파일이 깨지지 않았다.
 *
 * 그런데 이 목록은 `z.enum`으로 **런타임 파서**가 된다. 모르는 상태가 오면 폴백이 아니라
 * `parse` 실패이고, 결제를 마친 사용자의 화면이 통째로 깨진다 — 조용한 오표시보다 나쁘다.
 *
 * 그래서 rotation 때문에 좁게 잡아야 하는 객체 전체 대신 **status 필드만** 양방향으로 건다.
 * 백엔드가 상태를 늘리면 여기서 컴파일이 멈춘다.
 *
 * `MutuallyAssignable`을 쓰지 않고 튜플로 감싸는 이유: 조건부 타입은 유니온에 **분배**되므로
 * `"A"|"B" extends X`가 각 멤버마다 판정돼 결과가 `boolean`이 된다. 그러면 목록이 맞든 틀리든
 * 늘 실패해 단언이 무의미해진다. 대괄호로 감싸면 분배가 멈춘다 — `error-codes.ts`가 에러 코드
 * 유니온에 쓰는 것과 같은 방식이다.
 */
type ContractStatus = Schemas["ReservationRequestResponse"]["status"];

export type ReservationStatusMatchesContract = Assert<
  [ReservationRequest["status"]] extends [ContractStatus]
    ? [ContractStatus] extends [ReservationRequest["status"]]
      ? true
      : false
    : false
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
    // 예시값을 계약의 실제 상태로 쓰면 계약이 넓어질 때 이 테스트가 거짓으로 깨진다 —
    // Sprint 1에는 "PAID"를 썼고 Sprint 2에서 그 값이 계약에 들어오면서 실제로 깨졌다.
    expect(
      reservationRequestSchema.safeParse({ ...RESERVATION, status: "NOT_A_REAL_STATUS" }).success,
    ).toBe(false);
  });

  it("Sprint 2에서 추가된 결제 단계 상태를 받는다", () => {
    for (const status of ["PAYMENT_PENDING", "PAID", "CANCELLED"]) {
      expect(reservationRequestSchema.safeParse({ ...RESERVATION, status }).success).toBe(true);
    }
  });
});
