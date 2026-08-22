import { useQuery } from "@tanstack/react-query";

import { searchSpaces } from "../../lib/api/spaces";
import { toSearchParams, type SpaceSearchState } from "./searchState";
import { useDebouncedValue } from "./useDebouncedValue";

/**
 * 반경 공실 검색.
 *
 * 쿼리 키에 좌표·반경·필터를 모두 담는다 — 하나라도 빠지면 조건이 다른 결과가 같은 키를 덮어써
 * 캐시가 오염된다.
 */
export function useSpaceSearch(search: SpaceSearchState) {
  const debounced = useDebouncedValue(search);
  const params = toSearchParams(debounced);

  const query = useQuery({
    queryKey: ["spaces", "search", params],
    queryFn: () => searchSpaces(params),
  });

  return {
    ...query,
    /** 디바운스 때문에 입력과 결과가 한 박자 어긋나는 구간. */
    isSettling: debounced !== search,
  };
}
