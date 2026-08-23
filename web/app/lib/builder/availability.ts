import type { LayoutItem } from "../schemas/layout";

/**
 * 날짜별 집기 가용 수량 판정 (US-102 빌더 보완, I-3).
 *
 * `GET /spaces/{id}/fixture-availability`의 `availableQty`는 **다른 예약이 잡아간 뒤 남은 수량**이고
 * 내가 지금 캔버스에 놓은 것은 포함하지 않는다. 그래서 실제로 더 놓을 수 있는 수는
 * `availableQty - 내가 놓은 수`다.
 *
 * **품절은 조용히 지우는 대신 드러낸다.** 기간을 바꾸면 이미 놓아둔 집기가 품절이 될 수 있는데,
 * 그때 캔버스에서 자동으로 빼면 사용자는 도면이 왜 바뀌었는지 모른다. 초과 상태로 두고
 * 경고한 뒤 사용자가 직접 정리하게 한다 — 제출하면 서버가 409 `FIXTURE_UNAVAILABLE`로 막는다.
 */

/** `GET /spaces/{id}/fixture-availability` 응답 한 건. */
export type FixtureAvailability = {
  fixtureId: number;
  totalStock: number;
  reservedQty: number;
  /** 다른 예약을 뺀 잔여. **내 캔버스 배치는 포함되지 않는다.** */
  availableQty: number;
};

export type FixtureAvailabilityState = {
  /** 다른 예약을 뺀 잔여 수량. */
  availableQty: number;
  /** 내가 캔버스에 놓은 수. */
  placedQty: number;
  /** 지금 더 놓을 수 있는 수. 음수가 되지 않는다. */
  remainingQty: number;
  /** 더 놓을 수 없다. 팔레트에서 비활성으로 보여준다. */
  isSoldOut: boolean;
  /**
   * 이미 놓은 수가 잔여를 넘었다 — 기간을 바꿔 가용 수량이 줄었을 때 생긴다.
   * 이 상태로 제출하면 서버가 409로 막으므로 **제출 전에 알려야 한다.**
   */
  isOverPlaced: boolean;
};

export type AvailabilityMap = Readonly<Record<number, FixtureAvailabilityState>>;

/** 배치 목록에서 집기별 개수를 센다. */
export function countPlaced(items: readonly LayoutItem[]): Record<number, number> {
  const counts: Record<number, number> = {};

  for (const item of items) {
    counts[item.fixtureId] = (counts[item.fixtureId] ?? 0) + 1;
  }

  return counts;
}

/**
 * 가용 수량 응답 + 현재 배치 → 집기별 판정.
 *
 * 응답에 없는 집기는 **판정하지 않는다**(맵에 넣지 않는다). 없는 것을 품절로 취급하면
 * 아직 조회 전인 상태에서 팔레트 전체가 잠긴다.
 */
export function toAvailabilityMap(
  availability: readonly FixtureAvailability[],
  items: readonly LayoutItem[],
): AvailabilityMap {
  const placed = countPlaced(items);
  const map: Record<number, FixtureAvailabilityState> = {};

  for (const entry of availability) {
    const placedQty = placed[entry.fixtureId] ?? 0;
    const remaining = entry.availableQty - placedQty;

    map[entry.fixtureId] = {
      availableQty: entry.availableQty,
      placedQty,
      remainingQty: Math.max(remaining, 0),
      isSoldOut: remaining <= 0,
      isOverPlaced: remaining < 0,
    };
  }

  return map;
}

/** 잔여를 넘겨 놓은 집기 id 목록. 경고 문구를 만들 때 쓴다. */
export function overPlacedFixtureIds(map: AvailabilityMap): number[] {
  return Object.entries(map)
    .filter(([, state]) => state.isOverPlaced)
    .map(([fixtureId]) => Number(fixtureId));
}
