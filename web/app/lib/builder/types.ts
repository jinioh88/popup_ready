/**
 * 빌더 순수 계산 계층의 공용 타입.
 *
 * 이 계층은 React·Konva에 의존하지 않는다(web/CLAUDE.md 파일 구조 규칙).
 * 픽셀 값은 렌더 계층(app/features)에서만 다루고, 여기서는 셀 좌표만 오간다.
 */

/** 그리드 셀 좌표. 좌상단 0-base. */
export type CellCoord = {
  col: number;
  row: number;
};

/** 집기 규격 — `GET /fixtures` 응답 중 배치·견적에 필요한 필드만. */
export type FixtureSpec = {
  id: number;
  widthMm: number;
  depthMm: number;
  powerWatt: number;
  dailyRentalFee: number;
};

/** fixtureId → 규격 조회표. 서버 상태(TanStack Query)를 스토어에 복제하지 않기 위한 주입 지점. */
export type FixtureLookup = Readonly<Record<number, FixtureSpec>>;

/** 그리드 위 점유 사각형. `cols`/`rows`는 회전이 반영된 점유 크기다. */
export type Placement = CellCoord & {
  cols: number;
  rows: number;
};
