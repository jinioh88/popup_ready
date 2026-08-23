import { describe, expect, it } from "vitest";

import {
  countPlaced,
  overPlacedFixtureIds,
  toAvailabilityMap,
  type FixtureAvailability,
} from "./availability";
import type { LayoutItem } from "../schemas/layout";

function at(fixtureId: number): LayoutItem {
  return { fixtureId, col: 0, row: 0, rotation: 0 };
}

const AVAILABILITY: FixtureAvailability[] = [
  { fixtureId: 1, totalStock: 10, reservedQty: 8, availableQty: 2 },
  { fixtureId: 2, totalStock: 5, reservedQty: 5, availableQty: 0 },
  { fixtureId: 3, totalStock: 20, reservedQty: 0, availableQty: 20 },
];

describe("countPlaced", () => {
  it("집기별 개수를 센다", () => {
    expect(countPlaced([at(1), at(1), at(3)])).toEqual({ 1: 2, 3: 1 });
  });

  it("빈 배치는 빈 결과다", () => {
    expect(countPlaced([])).toEqual({});
  });
});

describe("toAvailabilityMap — 잔여 계산", () => {
  it("내가 놓은 수를 잔여에서 뺀다", () => {
    // availableQty는 **다른 예약**을 뺀 값이라 내 배치는 따로 빼야 한다.
    const map = toAvailabilityMap(AVAILABILITY, [at(1)]);

    expect(map[1]).toMatchObject({ availableQty: 2, placedQty: 1, remainingQty: 1 });
  });

  it("아무것도 안 놓았으면 잔여가 그대로다", () => {
    const map = toAvailabilityMap(AVAILABILITY, []);

    expect(map[3]).toMatchObject({ placedQty: 0, remainingQty: 20, isSoldOut: false });
  });
});

describe("toAvailabilityMap — 품절", () => {
  it("잔여가 0이면 품절이다", () => {
    const map = toAvailabilityMap(AVAILABILITY, []);

    expect(map[2]).toMatchObject({ isSoldOut: true, remainingQty: 0, isOverPlaced: false });
  });

  it("남은 것을 다 놓으면 품절이 된다", () => {
    const map = toAvailabilityMap(AVAILABILITY, [at(1), at(1)]);

    expect(map[1]).toMatchObject({ remainingQty: 0, isSoldOut: true, isOverPlaced: false });
  });

  it("품절이어도 초과가 아니면 경고 대상이 아니다", () => {
    // 딱 맞게 쓴 것과 넘겨 쓴 것은 다르다 — 전자는 정상 제출된다.
    const map = toAvailabilityMap(AVAILABILITY, [at(1), at(1)]);

    expect(overPlacedFixtureIds(map)).toEqual([]);
  });
});

describe("toAvailabilityMap — 초과 배치", () => {
  it("기간을 바꿔 가용이 줄면 초과로 잡힌다", () => {
    // 3개 놓아둔 상태에서 다른 예약이 늘어 잔여가 2로 줄어든 경우.
    const map = toAvailabilityMap(AVAILABILITY, [at(1), at(1), at(1)]);

    expect(map[1]).toMatchObject({ placedQty: 3, isOverPlaced: true, isSoldOut: true });
    // 잔여는 음수로 내려가지 않는다 — 화면에 "-1개 남음"이 뜨면 안 된다.
    expect(map[1].remainingQty).toBe(0);
  });

  it("초과한 집기만 골라낸다", () => {
    const map = toAvailabilityMap(AVAILABILITY, [at(1), at(1), at(1), at(2), at(3)]);

    expect(overPlacedFixtureIds(map).sort()).toEqual([1, 2]);
  });
});

describe("toAvailabilityMap — 응답에 없는 집기", () => {
  it("판정하지 않는다 — 없는 것을 품절로 만들지 않는다", () => {
    // 조회 전이거나 응답이 일부만 온 상태에서 팔레트 전체가 잠기면 안 된다.
    const map = toAvailabilityMap(AVAILABILITY, [at(99)]);

    expect(map[99]).toBeUndefined();
  });

  it("빈 응답이면 아무것도 잠기지 않는다", () => {
    expect(toAvailabilityMap([], [at(1), at(2)])).toEqual({});
  });
});
