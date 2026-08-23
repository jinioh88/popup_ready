import { rentalDays } from "../datetime";
import type { FixtureSpec } from "./types";

/**
 * 예약 견적 합산 — 서버 응답 검증·표시용.
 *
 * 원장은 백엔드다(`POST /reservation-requests`가 재계산한다). 이 함수는 빌더에서
 * 실시간으로 보여줄 값을 만들고, 서버 응답과 어긋나면 계약 위반 신호로 삼는다.
 *
 *   days               = 시작일·종료일을 모두 포함한 일수 (start === end 이면 1일)
 *   spaceRentTotal     = days × space.dailyRent
 *   fixtureRentalTotal = days × Σ(배치된 집기의 dailyRentalFee)
 *   deposit            = round(spaceRentTotal × space.depositRate)   // 원 단위, HALF_UP
 *   totalAmount        = spaceRentTotal + fixtureRentalTotal + deposit
 *
 * **보증금 기준은 `spaceRentTotal`이다 — 집기 렌털료는 포함하지 않는다**(sprint1.md §2.2 확정).
 * 계약 조항 요건이 "공간 대여료 대비 소액"으로 기준을 적고 있고, `depositRate`가 Space의 속성이며,
 * 일시사용 임대차 요건 보존상 보증금은 작을수록 안전하기 때문이다. 집기 손상은 보증금이 아니라
 * US-401 퇴실 검수·정산 경로가 담당한다.
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

export function estimateReservation(input: EstimateInput): Estimate {
  const days = rentalDays(input.startDate, input.endDate);
  const dailyFixtureFee = input.fixtures.reduce((sum, fixture) => sum + fixture.dailyRentalFee, 0);

  const spaceRentTotal = days * input.dailyRent;
  const fixtureRentalTotal = days * dailyFixtureFee;
  const deposit = applyRateHalfUp(spaceRentTotal, input.depositRate);

  return {
    days,
    spaceRentTotal,
    fixtureRentalTotal,
    deposit,
    totalAmount: spaceRentTotal + fixtureRentalTotal + deposit,
  };
}

/**
 * `amount × rate`를 원 단위 HALF_UP으로 맺는다.
 *
 * 백엔드는 `BigDecimal`로 십진 연산한다. 여기서 `Math.round(amount * rate)`를 쓰면 `rate`가
 * 이진 부동소수로 표현되지 않는 값(0.1 등)일 때 반올림 경계에서 1원이 어긋날 수 있으므로,
 * 비율을 정수로 올려 **정수 연산만으로** 계산해 그 가능성을 없앤다.
 */
function applyRateHalfUp(amount: number, rate: number): number {
  const decimals = (String(rate).split(".")[1] ?? "").length;
  const scale = 10 ** decimals;
  const scaledProduct = amount * Math.round(rate * scale);

  const quotient = Math.floor(scaledProduct / scale);
  const remainder = scaledProduct - quotient * scale;

  return remainder * 2 >= scale ? quotient + 1 : quotient;
}
