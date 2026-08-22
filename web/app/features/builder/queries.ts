import { useQuery } from "@tanstack/react-query";

import { listFixtures } from "../../lib/api/fixtures";
import { getSpaceDetail } from "../../lib/api/spaces";
import type { Fixture } from "../../lib/schemas/api";

/**
 * fixtureId → 집기 조회표.
 *
 * 배치 판정에 필요한 규격(`FixtureLookup`)의 상위 집합이라 스토어 액션에 그대로 넘길 수 있고,
 * 렌더에 필요한 이름·카테고리까지 들고 있다.
 */
export type FixtureCatalog = Readonly<Record<number, Fixture>>;

/** 빌더 화면이 쓰는 서버 상태. 캔버스 상태(Zustand)와 달리 여기 캐시는 TanStack Query가 소유한다. */

export function spaceDetailQueryKey(spaceId: number) {
  return ["spaces", spaceId] as const;
}

export const FIXTURES_QUERY_KEY = ["fixtures"] as const;

export function useSpaceDetail(spaceId: number) {
  return useQuery({
    queryKey: spaceDetailQueryKey(spaceId),
    queryFn: () => getSpaceDetail(spaceId),
    enabled: Number.isFinite(spaceId),
  });
}

/**
 * 집기 카탈로그는 카테고리 탭이 바뀔 때마다 다시 받지 않는다 — 전량을 한 번 받아 화면에서 거른다.
 * 배치 판정에도 **전 카테고리 규격**이 필요하기 때문이다(다른 탭의 집기와도 겹칠 수 있다).
 */
export function useFixtures() {
  return useQuery({
    queryKey: FIXTURES_QUERY_KEY,
    queryFn: () => listFixtures(),
    staleTime: 5 * 60_000,
  });
}

export function toFixtureCatalog(fixtures: readonly Fixture[] | undefined): FixtureCatalog {
  const lookup: Record<number, Fixture> = {};

  for (const fixture of fixtures ?? []) {
    lookup[fixture.id] = fixture;
  }

  return lookup;
}
