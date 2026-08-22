import { z } from "zod";

/**
 * 레이아웃 JSON 스키마 — 파트 간 합의사항 (sprint1.md §2.3).
 *
 * 웹 빌더가 만들고 백엔드 `ReservationRequest.layout`(JSONB)에 저장된다.
 * **좌표 단위는 픽셀이 아니라 그리드 셀**이고 `col`/`row`는 좌상단 0-base다.
 * 스키마를 바꾸려면 스프린트 문서 갱신 + PM 보고가 선행이다.
 */

/**
 * 0 | 90 | 180 | 270 — 90/270이면 점유 폭·깊이를 스왑한다.
 *
 * OpenAPI 스펙에는 정수 범위(0~270)로만 표기된다(springdoc 제약, sprint1.md §2.2 표기 규약).
 * 생성 타입이 `number`로 나오므로 90 배수 판정은 웹에서 이 스키마가, 서버에서 재검증이 맡는다.
 */
export const ROTATIONS = [0, 90, 180, 270] as const;

export const rotationSchema = z.union([
  z.literal(0),
  z.literal(90),
  z.literal(180),
  z.literal(270),
]);

export const layoutItemSchema = z.object({
  fixtureId: z.number().int().positive(),
  col: z.number().int().min(0),
  row: z.number().int().min(0),
  rotation: rotationSchema,
});

export const layoutSchema = z.object({
  gridCols: z.number().int().positive(),
  gridRows: z.number().int().positive(),
  cellSizeMm: z.number().int().positive(),
  items: z.array(layoutItemSchema),
});

export type Rotation = z.infer<typeof rotationSchema>;
export type LayoutItem = z.infer<typeof layoutItemSchema>;
export type Layout = z.infer<typeof layoutSchema>;

/** 캔버스 그리드 규격 — `GET /spaces/{id}` 응답의 grid 정보와 같은 모양. */
export type GridSpec = Pick<Layout, "gridCols" | "gridRows" | "cellSizeMm">;
