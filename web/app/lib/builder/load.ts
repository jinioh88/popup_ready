import { occupiedCellCount } from "./occupancy";
import type { FixtureLookup, FixtureSpec } from "./types";
import type { GridSpec, LayoutItem } from "../schemas/layout";

/**
 * 배치 부하 합산 (US-103) — 전력 게이트 + 면적 점유율.
 *
 * **두 축의 성격이 다르다**(sprint2.md §2.2-F, 2026-08-23 PM 결정).
 *
 *   전력  = 하드 게이트. `maxPowerWatt`를 넘으면 제출을 막는다(서버도 400으로 막는다).
 *   면적  = 잠기지 않는 밀도 표시. 넘어도 제출할 수 있고 **서버는 판정하지 않는다.**
 *
 * 당초 지시서는 면적도 `floorAreaM2` 초과 시 400으로 막게 돼 있었으나 철회됐다. 그리드 전체
 * 면적이 `floorAreaM2`보다 작아서(계약 예시: 20×12칸 × 500mm = 60㎡ vs 82.5㎡) 그리드 경계
 * 판정을 통과한 배치는 면적 한도를 **구조적으로 넘을 수 없었다** — 죽은 검사였다. 둘이 다른
 * 것을 재기 때문이다: `floorAreaM2`는 상가 실면적(벽·통로·출입구 포함), 그리드는 배치 가능 영역.
 *
 * 그래서 면적의 분모는 `floorAreaM2`가 아니라 **그리드 전체 면적**이고, 임계는 100% 차단이
 * 아니라 **70% 소프트 경고**(동선 확보)다.
 */

/** 전력 축 — 임박/초과가 있는 게이트. */
export type PowerLevel = "safe" | "near" | "over";

/**
 * 면적 축 — `over`가 **없다.** 같은 유니온을 쓰면 면적에도 `over`를 넣을 수 있게 되고,
 * 그 순간 철회된 게이트가 되살아난다. 타입 수준에서 막는다.
 */
export type AreaLevel = "safe" | "crowded";

/** 전력 임박 임계 — 스타일가이드 §1.2(80% 이상 `warning`). */
export const POWER_NEAR_RATIO = 0.8;

/**
 * 면적 혼잡 임계 — sprint2.md §2.2-F 3항이 정하는 **공통 상수**다.
 * `Space` 스키마에 필드를 추가하지 않는다(백엔드와 합의된 스코프).
 */
export const AREA_CROWDED_RATIO = 0.7;

export type LoadSummary = {
  power: {
    /** 배치된 집기 소비전력 합(W). */
    watt: number;
    /** `space.maxPowerWatt`. */
    limit: number;
    /** `watt / limit`. limit이 0 이하면 0. */
    ratio: number;
    level: PowerLevel;
  };
  area: {
    /** 점유 셀 면적(㎡) — 셀 양자화값이다. 실치수가 아니다. */
    m2: number;
    /** 그리드 전체 면적(㎡). 한도가 아니라 분모다. */
    gridM2: number;
    ratio: number;
    level: AreaLevel;
  };
  /**
   * 제출을 막아야 하는가. **전력 초과일 때만 `true`다** — 면적은 절대 여기 들어가지 않는다.
   *
   * 이것은 UX이지 게이트가 아니다(§2.2-D). 서버가 400 `POWER_LIMIT_EXCEEDED`를 주는 경로도
   * 정상 경로로 처리해야 하며, "프론트에서 막았으니 서버는 안 막아도 된다"고 가정하지 않는다.
   */
  blocksSubmit: boolean;
  /** 규격을 못 찾은 집기가 있었는가. `true`면 합산이 실제보다 작다 — 조용히 넘기지 않는다. */
  hasUnknownFixture: boolean;
};

export type LoadInput = {
  items: readonly LayoutItem[];
  fixtures: FixtureLookup;
  grid: GridSpec;
  /** `space.maxPowerWatt` */
  maxPowerWatt: number;
};

export function summarizeLoad(input: LoadInput): LoadSummary {
  const { items, fixtures, grid, maxPowerWatt } = input;

  let watt = 0;
  let occupiedCells = 0;
  let hasUnknownFixture = false;

  for (const item of items) {
    const spec: FixtureSpec | undefined = fixtures[item.fixtureId];

    if (!spec) {
      // 빼고 합산하면 한도 내로 보이는 값이 나오고, 서버 재검증에서 400으로 되돌아온다.
      hasUnknownFixture = true;
      continue;
    }

    watt += spec.powerWatt;
    // **`ceil`을 여기서 다시 쓰지 않는다** — 백엔드 재검증과 같은 계산식이어야 하므로
    // occupancy.ts의 함수를 그대로 호출한다(sprint2.md §2.2-F 4항).
    occupiedCells += occupiedCellCount(spec, grid.cellSizeMm, item.rotation);
  }

  const cellM2 = cellAreaM2(grid.cellSizeMm);
  const m2 = occupiedCells * cellM2;
  const gridM2 = grid.gridCols * grid.gridRows * cellM2;

  const powerRatio = ratioOf(watt, maxPowerWatt);
  const areaRatio = ratioOf(m2, gridM2);

  return {
    power: {
      watt,
      limit: maxPowerWatt,
      ratio: powerRatio,
      level: powerLevel(powerRatio),
    },
    area: {
      m2,
      gridM2,
      ratio: areaRatio,
      level: areaRatio >= AREA_CROWDED_RATIO ? "crowded" : "safe",
    },
    blocksSubmit: powerRatio > 1,
    hasUnknownFixture,
  };
}

/** 셀 하나의 면적(㎡). mm² → m²는 10⁶으로 나눈다. */
function cellAreaM2(cellSizeMm: number): number {
  return (cellSizeMm * cellSizeMm) / 1_000_000;
}

/** 한도가 0 이하면 비율을 정의할 수 없다 — 0으로 둬서 '초과'로 오판하지 않는다. */
function ratioOf(value: number, limit: number): number {
  return limit > 0 ? value / limit : 0;
}

function powerLevel(ratio: number): PowerLevel {
  if (ratio > 1) {
    return "over";
  }

  return ratio >= POWER_NEAR_RATIO ? "near" : "safe";
}

/**
 * 두 합산 결과가 같은 값인가.
 *
 * `summarizeLoad`는 호출할 때마다 **새 객체**를 돌려주므로, 결과를 그대로 상태에 넣으면 값이
 * 그대로여도 리렌더가 난다. 그 리렌더가 다시 합산을 예약하면(입력 배열의 identity가 매 렌더
 * 바뀌는 호출부에서 실제로 그렇게 된다) 상태가 **영영 한 박자 뒤처진 채** 맴돈다.
 *
 * 값이 같으면 이전 객체를 그대로 유지해 그 고리를 끊는다 — `BuilderCanvas`가 드롭 미리보기에
 * 쓰는 `isSamePreview`와 같은 이유, 같은 방식이다.
 */
export function isSameLoad(a: LoadSummary, b: LoadSummary): boolean {
  return (
    a.blocksSubmit === b.blocksSubmit &&
    a.hasUnknownFixture === b.hasUnknownFixture &&
    a.power.watt === b.power.watt &&
    a.power.limit === b.power.limit &&
    a.power.ratio === b.power.ratio &&
    a.power.level === b.power.level &&
    a.area.m2 === b.area.m2 &&
    a.area.gridM2 === b.area.gridM2 &&
    a.area.ratio === b.area.ratio &&
    a.area.level === b.area.level
  );
}
