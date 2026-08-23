import type { FixtureCategory } from "../../lib/schemas/api";

/** 그리드 한 칸의 화면 크기(px). 셀 좌표 ↔ 픽셀 환산은 렌더 계층에서만 일어난다. */
export const CELL_PX = 32;

export const CATEGORY_LABELS: Record<FixtureCategory, string> = {
  HANGER: "행거",
  POS: "POS",
  SHOWCASE: "쇼케이스",
  LIGHTING: "조명",
  SHELF: "진열대",
  ETC: "기타",
};

export const CATEGORY_ORDER: FixtureCategory[] = [
  "HANGER",
  "POS",
  "SHOWCASE",
  "LIGHTING",
  "SHELF",
  "ETC",
];

/** 스타일가이드 토큰과 같은 값 — Konva는 CSS 클래스를 못 쓰므로 여기서만 HEX로 참조한다. */
export const CANVAS_COLORS = {
  surface: "#ffffff",
  grid: "#e2e8f0",
  fixture: "#eef2ff",
  fixtureBorder: "#4f46e5",
  selected: "#4338ca",
  invalid: "#dc2626",
  text: "#0f172a",
} as const;
