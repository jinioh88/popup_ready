import { z } from "zod";

import { rentalDays } from "../datetime";

/**
 * 예약 기간 입력 스키마.
 *
 * UI 비종속이라 mobile/에서도 그대로 쓸 수 있다. 날짜 표기는 계약과 같은 `yyyy-MM-dd`다
 * (sprint1.md §2.2 표기 규약).
 */

/**
 * 사용 기간 상한(일). **법률 세이프가드다** — 상가건물 임대차보호법상 일시사용 임대차 요건을
 * 시스템이 게이트로 보증한다(백엔드 `ReservationPeriod.MAX_DAYS`와 같은 값이어야 한다).
 *
 * 백엔드 판정은 `startDate.plusDays(29).isBefore(endDate)`면 거부 —
 * **양끝 포함 30일까지 허용, 31일부터 400**이다. 여기서도 같은 경계를 쓴다.
 */
export const MAX_RESERVATION_DAYS = 30;

const localDate = z
  .string()
  .min(1, "날짜를 선택해 주세요.")
  .regex(/^\d{4}-\d{2}-\d{2}$/, "yyyy-MM-dd 형식이 아닙니다.");

export const reservationPeriodSchema = z
  .object({
    startDate: localDate,
    endDate: localDate,
  })
  .refine((value) => value.startDate <= value.endDate, {
    // yyyy-MM-dd는 사전순 비교가 곧 날짜 비교다.
    message: "종료일은 시작일과 같거나 이후여야 합니다.",
    path: ["endDate"],
  })
  .refine(
    (value) =>
      // 순서가 뒤집힌 경우는 위 refine이 이미 잡는다 — 여기서 0일을 통과시켜도 중복 안내가 되지 않는다.
      value.startDate > value.endDate ||
      rentalDays(value.startDate, value.endDate) <= MAX_RESERVATION_DAYS,
    {
      message: `사용 기간은 최대 ${MAX_RESERVATION_DAYS}일입니다. 더 긴 기간은 기간을 나눠 예약해 주세요.`,
      path: ["endDate"],
    },
  );

export type ReservationPeriod = z.infer<typeof reservationPeriodSchema>;

/**
 * 시작일이 정해졌을 때 고를 수 있는 마지막 종료일(`yyyy-MM-dd`).
 *
 * 상한을 화면에서도 한 번 더 표현하기 위한 것이다 — 판정의 원장은 위 스키마이고, 이 값은
 * `<input type="date">`의 `max`로 넘겨 **애초에 고를 수 없게** 만드는 데 쓴다.
 * 상한이 30일이므로 마지막 날은 시작일 + 29일이다(양끝 포함).
 */
export function maxEndDate(startDate: string): string | undefined {
  return shiftDate(startDate, MAX_RESERVATION_DAYS - 1);
}

/**
 * 종료일이 먼저 정해졌을 때 고를 수 있는 **가장 이른 시작일**(`yyyy-MM-dd`).
 *
 * `maxEndDate`의 짝이다. 한쪽 방향만 막으면 **선택 순서로 상한이 뚫린다** —
 * 종료일을 먼저 찍고 시작일을 한참 앞으로 잡으면 달력이 30일을 넘겨도 그대로 통과했다
 * (2026-08-23 사용자 인수 테스트에서 발견). 양쪽 `min`/`max`를 모두 걸어야 순서와 무관하게
 * 막힌다. 판정의 원장은 여전히 위 스키마이고 최종 판정은 서버다.
 */
export function minStartDate(endDate: string): string | undefined {
  return shiftDate(endDate, -(MAX_RESERVATION_DAYS - 1));
}

/** `yyyy-MM-dd`를 일 단위로 옮긴다. 날짜로 못 읽으면 undefined. */
function shiftDate(date: string, days: number): string | undefined {
  const base = Date.parse(`${date}T00:00:00Z`);

  if (Number.isNaN(base)) {
    return undefined;
  }

  return new Date(base + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
