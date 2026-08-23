import { z } from "zod";

import { layoutSchema } from "./layout";

/**
 * API 경계 런타임 파싱 — **핵심 4종** (sprint1.md §2.2 파이프라인 규칙 + PM 승인 예외).
 *
 *   `GET /spaces` · `GET /fixtures` · `POST /reservation-requests`
 *   + 계약 응답(`schemas/contract.ts` — 2026-08-23 PM 승인 예외, 4종째)
 *
 * 생성 타입(`app/lib/api/schema.d.ts`)은 컴파일 타임 보증만 준다. 예상과 다른 null이나
 * 날짜 포맷 같은 런타임 불일치는 못 잡으므로 **골라서** Zod로 막는다. 전면 도입은 하지 않는다.
 * 대상 추가는 '치명도'(조용한 훼손이 사용자 피해로 직결되는가) 기준이며 PM 승인 사항이다.
 */

/** 위경도(WGS84) */
export const locationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

/** yyyy-MM-dd (LocalDate) — sprint1.md §2.2 표기 규약 */
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "yyyy-MM-dd 형식이 아닙니다.");

export const FIXTURE_CATEGORIES = [
  "HANGER",
  "POS",
  "SHOWCASE",
  "LIGHTING",
  "SHELF",
  "ETC",
] as const;

export const RESERVATION_STATUSES = ["DRAFT", "CONTRACT_PENDING", "CONTRACT_SIGNED"] as const;

/** `GET /spaces` — 지도 마커용 요약 */
export const spaceSummarySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  address: z.string(),
  location: locationSchema,
  dailyRent: z.number().int(),
  floorAreaM2: z.number(),
  maxPowerWatt: z.number().int(),
});

export const spaceSummaryListSchema = z.array(spaceSummarySchema);

/** `GET /fixtures` — 집기 라이브러리 */
export const fixtureSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  category: z.enum(FIXTURE_CATEGORIES),
  widthMm: z.number().int(),
  depthMm: z.number().int(),
  powerWatt: z.number().int(),
  dailyRentalFee: z.number().int(),
  stockQty: z.number().int(),
});

export const fixtureListSchema = z.array(fixtureSchema);

/** 견적 breakdown — 웹의 `estimateReservation()` 결과와 필드가 1:1로 대응해야 한다. */
export const estimateSchema = z.object({
  days: z.number().int(),
  spaceRentTotal: z.number().int(),
  fixtureRentalTotal: z.number().int(),
  deposit: z.number().int(),
  totalAmount: z.number().int(),
});

/** `POST /reservation-requests` — 생성된 예약 요청 */
export const reservationRequestSchema = z.object({
  id: z.number().int(),
  spaceId: z.number().int(),
  brandUserId: z.number().int(),
  startDate: localDate,
  endDate: localDate,
  status: z.enum(RESERVATION_STATUSES),
  layout: layoutSchema,
  estimate: estimateSchema,
});

export type Location = z.infer<typeof locationSchema>;
export type SpaceSummary = z.infer<typeof spaceSummarySchema>;
export type Fixture = z.infer<typeof fixtureSchema>;
export type FixtureCategory = z.infer<typeof fixtureSchema>["category"];
export type EstimateResponse = z.infer<typeof estimateSchema>;
export type ReservationRequest = z.infer<typeof reservationRequestSchema>;
