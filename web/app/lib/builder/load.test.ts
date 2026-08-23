import { describe, expect, it } from "vitest";

import { AREA_CROWDED_RATIO, isSameLoad, POWER_NEAR_RATIO, summarizeLoad } from "./load";
import type { FixtureLookup } from "./types";
import type { GridSpec, LayoutItem } from "../schemas/layout";

/** 10×10칸 × 500mm = 5m × 5m = 25㎡. 셀 하나는 0.25㎡. */
const GRID: GridSpec = { gridCols: 10, gridRows: 10, cellSizeMm: 500 };

const FIXTURES: FixtureLookup = {
  // 1000×500mm → 2×1칸 = 2셀 = 0.5㎡
  1: { id: 1, widthMm: 1000, depthMm: 500, powerWatt: 100, dailyRentalFee: 10_000 },
  // 500×500mm → 1×1칸 = 1셀 = 0.25㎡
  2: { id: 2, widthMm: 500, depthMm: 500, powerWatt: 0, dailyRentalFee: 5_000 },
  // 2500×1000mm → 5×2칸 = 10셀 = 2.5㎡
  3: { id: 3, widthMm: 2500, depthMm: 1000, powerWatt: 800, dailyRentalFee: 40_000 },
};

function at(fixtureId: number, rotation: 0 | 90 | 180 | 270 = 0): LayoutItem {
  return { fixtureId, col: 0, row: 0, rotation };
}

function summarize(items: readonly LayoutItem[], maxPowerWatt = 1000) {
  return summarizeLoad({ items, fixtures: FIXTURES, grid: GRID, maxPowerWatt });
}

describe("summarizeLoad — 전력 축(게이트)", () => {
  it("배치가 없으면 0W이고 제출을 막지 않는다", () => {
    const load = summarize([]);

    expect(load.power.watt).toBe(0);
    expect(load.power.level).toBe("safe");
    expect(load.blocksSubmit).toBe(false);
  });

  it("배치된 집기의 powerWatt를 합산한다", () => {
    const load = summarize([at(1), at(1), at(3)]);

    expect(load.power.watt).toBe(1000);
  });

  it("79.9%는 아직 safe다", () => {
    const load = summarize([at(3)], 1002); // 800 / 1002 ≈ 0.7984

    expect(load.power.level).toBe("safe");
  });

  it("정확히 80%면 near로 넘어간다", () => {
    const load = summarize([at(3)], 1000); // 800 / 1000

    expect(load.power.ratio).toBe(POWER_NEAR_RATIO);
    expect(load.power.level).toBe("near");
  });

  it("정확히 100%는 초과가 아니다 — 한도까지는 쓸 수 있다", () => {
    const load = summarize([at(3), at(1), at(1)], 1000); // 800 + 100 + 100 = 1000

    expect(load.power.ratio).toBe(1);
    expect(load.power.level).toBe("near");
    expect(load.blocksSubmit).toBe(false);
  });

  it("100%를 넘으면 over이고 제출을 막는다", () => {
    const load = summarize([at(3), at(1), at(1), at(1)], 1000); // 1100W

    expect(load.power.level).toBe("over");
    expect(load.blocksSubmit).toBe(true);
  });

  it("한도가 0이면 초과로 오판하지 않는다", () => {
    // 비율을 정의할 수 없는 값이다. 여기서 over로 만들면 배치 자체가 불가능해진다.
    const load = summarize([at(1)], 0);

    expect(load.power.ratio).toBe(0);
    expect(load.blocksSubmit).toBe(false);
  });
});

describe("summarizeLoad — 면적 축(점유율 표시)", () => {
  it("분모는 floorAreaM2가 아니라 그리드 전체 면적이다", () => {
    const load = summarize([]);

    expect(load.area.gridM2).toBe(25); // 10 × 10 × 0.25㎡
  });

  it("점유 면적은 셀 양자화값이다 — 실치수가 아니다", () => {
    // 집기 3은 2500×1000mm = 2.5㎡가 실치수이고 셀 양자화도 10셀 × 0.25 = 2.5㎡로 같다.
    // 집기 2는 500×500mm = 0.25㎡. 둘을 합치면 2.75㎡.
    const load = summarize([at(3), at(2)]);

    expect(load.area.m2).toBe(2.75);
  });

  it("셀에 딱 떨어지지 않는 규격은 올림된 셀 수로 잡힌다", () => {
    // 600×500mm는 ceil(600/500)=2칸 × 1칸 = 2셀 = 0.5㎡ (실치수 0.3㎡보다 크다)
    const fixtures: FixtureLookup = {
      9: { id: 9, widthMm: 600, depthMm: 500, powerWatt: 0, dailyRentalFee: 0 },
    };
    const load = summarizeLoad({
      items: [{ fixtureId: 9, col: 0, row: 0, rotation: 0 }],
      fixtures,
      grid: GRID,
      maxPowerWatt: 1000,
    });

    expect(load.area.m2).toBe(0.5);
  });

  it("90도 회전은 폭·깊이를 스왑해도 면적이 같다", () => {
    const upright = summarize([at(3, 0)]);
    const rotated = summarize([at(3, 90)]);

    expect(rotated.area.m2).toBe(upright.area.m2);
  });

  it("69.9%는 safe다", () => {
    // 25㎡의 70% = 17.5㎡. 17.25㎡(69셀)면 69%.
    const load = summarize(Array.from({ length: 69 }, () => at(2)));

    expect(load.area.ratio).toBeLessThan(AREA_CROWDED_RATIO);
    expect(load.area.level).toBe("safe");
  });

  it("정확히 70%면 crowded로 넘어간다", () => {
    // 70셀 × 0.25 = 17.5㎡ = 25㎡의 70%
    const load = summarize(Array.from({ length: 70 }, () => at(2)));

    expect(load.area.ratio).toBe(AREA_CROWDED_RATIO);
    expect(load.area.level).toBe("crowded");
  });

  it("면적이 100%여도 제출을 막지 않는다 — 철회된 게이트가 되살아나면 여기서 깨진다", () => {
    // 그리드 전체(100셀)를 채운다. 전력은 0W인 집기만 써서 전력 축을 배제한다.
    const load = summarize(Array.from({ length: 100 }, () => at(2)));

    expect(load.area.ratio).toBe(1);
    expect(load.area.level).toBe("crowded");
    expect(load.blocksSubmit).toBe(false);
  });

  it("그리드 면적이 0이면 비율을 0으로 둔다", () => {
    const load = summarizeLoad({
      items: [],
      fixtures: FIXTURES,
      grid: { gridCols: 0, gridRows: 0, cellSizeMm: 0 },
      maxPowerWatt: 1000,
    });

    expect(load.area.ratio).toBe(0);
    expect(load.area.level).toBe("safe");
  });
});

describe("summarizeLoad — 미상 집기", () => {
  it("규격을 못 찾으면 조용히 넘기지 않고 표시한다", () => {
    const load = summarize([at(1), at(999)]);

    expect(load.hasUnknownFixture).toBe(true);
  });

  it("전부 아는 집기면 표시하지 않는다", () => {
    const load = summarize([at(1), at(2)]);

    expect(load.hasUnknownFixture).toBe(false);
  });

  it("미상 집기는 합산에서 빠지므로 값이 실제보다 작다", () => {
    // 이 사실을 화면이 알아야 "한도 내"라고 잘못 안내하지 않는다.
    const withUnknown = summarize([at(3), at(999)]);
    const known = summarize([at(3)]);

    expect(withUnknown.power.watt).toBe(known.power.watt);
    expect(withUnknown.hasUnknownFixture).toBe(true);
  });
});

describe("isSameLoad", () => {
  it("같은 입력의 두 결과는 값이 같다고 본다", () => {
    // summarizeLoad는 매번 새 객체를 돌려준다 — 그래서 identity 비교로는 안 된다.
    const a = summarize([at(1), at(3)]);
    const b = summarize([at(1), at(3)]);

    expect(a).not.toBe(b);
    expect(isSameLoad(a, b)).toBe(true);
  });

  it("전력이 달라지면 다르다고 본다", () => {
    expect(isSameLoad(summarize([at(1)]), summarize([at(3)]))).toBe(false);
  });

  it("전력이 같아도 면적이 달라지면 다르다고 본다", () => {
    // 집기 2는 0W다 — 전력은 그대로인데 점유 면적만 늘어나는 경우를 놓치면 안 된다.
    expect(isSameLoad(summarize([at(1)]), summarize([at(1), at(2)]))).toBe(false);
  });

  it("한도가 달라지면 다르다고 본다", () => {
    expect(isSameLoad(summarize([at(1)], 1000), summarize([at(1)], 2000))).toBe(false);
  });

  it("미상 집기 여부가 달라지면 다르다고 본다", () => {
    expect(isSameLoad(summarize([at(1)]), summarize([at(1), at(999)]))).toBe(false);
  });
});
