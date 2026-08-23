import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { searchSpaces, type SpaceSearchParams } from "../../lib/api/spaces";
import { toSearchParams, type SpaceSearchState } from "./searchState";
import { useDebouncedValue } from "./useDebouncedValue";

/**
 * 반경 공실 검색.
 *
 * 쿼리 키에 좌표·반경·필터를 모두 담는다 — 하나라도 빠지면 조건이 다른 결과가 같은 키를 덮어써
 * 캐시가 오염된다.
 *
 * **디바운스는 객체가 아니라 직렬화한 값에 건다.** `search`는 상태가 바뀔 때마다 새 객체라
 * 값이 그대로여도 참조가 달라진다. 참조로 디바운스하면 지도 이동 콜백처럼 같은 값을 되돌려
 * 넣는 경로가 300ms 타이머를 계속 되감아 **입력한 필터가 영영 쿼리에 닿지 않을 수** 있다.
 * 같은 이유로 `isSettling`도 값 비교여야 한다 — 참조 비교는 늘 참이라 로딩이 걷히지 않는다.
 */
export function useSpaceSearch(search: SpaceSearchState) {
  const serialized = JSON.stringify(toSearchParams(search));
  const debounced = useDebouncedValue(serialized);

  const params = useMemo(() => JSON.parse(debounced) as SpaceSearchParams, [debounced]);

  const query = useQuery({
    queryKey: ["spaces", "search", params],
    queryFn: () => searchSpaces(params),
  });

  return {
    ...query,
    /** 디바운스 때문에 입력과 결과가 한 박자 어긋나는 구간. */
    isSettling: debounced !== serialized,
  };
}
