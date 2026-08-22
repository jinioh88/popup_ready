import { z } from "zod";

/**
 * 예약 기간 입력 스키마.
 *
 * UI 비종속이라 mobile/에서도 그대로 쓸 수 있다. 날짜 표기는 계약과 같은 `yyyy-MM-dd`다
 * (sprint1.md §2.2 표기 규약).
 */

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
  });

export type ReservationPeriod = z.infer<typeof reservationPeriodSchema>;
