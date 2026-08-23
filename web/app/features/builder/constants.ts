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

/**
 * 캔버스 팔레트 — Konva는 CSS 클래스를 못 쓰므로 여기서만 HEX로 참조한다.
 * **값은 전부 스타일가이드 §5.1 토큰과 일치해야 한다** — 여기서 새 색을 만들지 않는다.
 *
 * 배경이 밝은 표면(#FFFFFF)에서 어두운 캔버스(--color-canvas #0F172A)로 바뀌면서
 * 그 위 요소를 함께 재조정했다(sprint2-web.md T0-2). 실측 대비:
 *
 *   그리드선  text-muted #475569 on canvas  2.36:1  — 구조선은 옅어야 한다(흰 배경 시절 border는 1.23:1)
 *   집기 채움 primary-light #EEF2FF on canvas 15.97:1 — 도형은 채움으로 읽힌다
 *   집기 라벨 text #0F172A on 채움 #EEF2FF   15.97:1 — 라벨은 캔버스가 아니라 채움 위에 있다
 *   선택 테두리 primary-dark #4338CA on 채움   7.07:1 — 기본 테두리(primary 5.62:1)와 구분된다
 *   거부 하이라이트 error #DC2626 on canvas    3.70:1 — WCAG 1.4.11 비텍스트 3:1 충족
 *
 * `border`(#E2E8F0)를 그리드선으로 그대로 쓰면 어두운 배경에서 14.48:1이 되어 도면보다 격자가
 * 먼저 보인다. 밝은 배경에서 옅었던 색이 어두운 배경에서 가장 강한 색이 되기 때문이다.
 */
export const CANVAS_COLORS = {
  /** 도면 배경 — --color-canvas */
  background: "#0f172a",
  /** 격자선 — --color-text-muted */
  grid: "#475569",
  /** 집기 채움 — --color-primary-light */
  fixture: "#eef2ff",
  /** 집기 테두리 — --color-primary */
  fixtureBorder: "#4f46e5",
  /** 선택된 집기 테두리 — --color-primary-dark */
  selected: "#4338ca",
  /** 배치 불가 하이라이트 — --color-error */
  invalid: "#dc2626",
  /** 집기 라벨 — --color-text (집기 채움 위에 놓인다) */
  text: "#0f172a",
} as const;
