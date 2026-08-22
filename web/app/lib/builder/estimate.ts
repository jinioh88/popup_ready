import type { FixtureSpec } from "./types";

/**
 * 예약 견적 합산 — 서버 응답 검증·표시용.
 *
 * 원장은 백엔드다(`POST /reservation-requests`가 재계산한다). 이 함수는 빌더에서
 * 실시간으로 보여줄 값을 만들고, 서버 응답과 어긋나면 계약 위반 신호로 삼는다.
 *
 *   총액 = 일수 × (공간 대여료 + Σ집기 렌털료) + 보증금        (sprint1.md §4 기반작업 6)
 *
 * ⚠️ 다음 두 가지는 스프린트 문서에 명시가 없어 **웹이 가정한 해석**이다. 백엔드 구현과
 *    어긋나면 화면 금액과 서버 금액이 달라지므로, 통합(Phase G) 전에 맞춰야 한다.
 *    1. 일수는 시작일·종료일을 **모두 포함**한다(1일 팝업 = start === end = 1일).
 *    2. 보증금은 **대여료 소계 × depositRate**를 원 단위로 반올림한다.
 */

export type EstimateInput = {
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  /** 공간 일일 대여료(원/일) */
  dailyRent: number;
  /** 보증금 비율 — 일시사용 요건상 하향 설계(기본 0.1) */
  depositRate: number;
  /** 배치된 집기의 규격. 같은 집기를 여러 개 놓았다면 그 수만큼 들어온다. */
  fixtures: readonly Pick<FixtureSpec, "dailyRentalFee">[];
};

/**
 * 필드명은 `POST /reservation-requests` 응답의 `estimate` 객체와 **같게 맞춘다**
 * (sprint1.md §2.2). 서버 값과 1:1로 대조해야 불일치를 바로 잡아낼 수 있다.
 */
export type Estimate = {
  days: number;
  spaceRentTotal: number;
  fixtureRentalTotal: number;
  deposit: number;
  totalAmount: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 시작일·종료일을 모두 포함한 대여 일수. 종료일이 시작일보다 이르면 0을 돌려준다. */
export function rentalDays(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);

  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 0;
  }

  return Math.round((end - start) / MS_PER_DAY) + 1;
}

export function estimateReservation(input: EstimateInput): Estimate {
  const days = rentalDays(input.startDate, input.endDate);
  const dailyFixtureFee = input.fixtures.reduce((sum, fixture) => sum + fixture.dailyRentalFee, 0);

  const spaceRentTotal = days * input.dailyRent;
  const fixtureRentalTotal = days * dailyFixtureFee;
  const rentSubtotal = spaceRentTotal + fixtureRentalTotal;
  const deposit = Math.round(rentSubtotal * input.depositRate);

  return {
    days,
    spaceRentTotal,
    fixtureRentalTotal,
    deposit,
    totalAmount: rentSubtotal + deposit,
  };
}
