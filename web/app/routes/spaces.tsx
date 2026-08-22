import { useMemo, useState } from "react";

import { SpaceFilters } from "../features/spaces/SpaceFilters";
import { SpaceResults } from "../features/spaces/SpaceResults";
import { SpaceSummaryPanel } from "../features/spaces/SpaceSummaryPanel";
import { useSpaceSearch } from "../features/spaces/queries";
import { DEFAULT_SEARCH, type SpaceSearchState } from "../features/spaces/searchState";

export function meta() {
  return [{ title: "공간 찾기 · PopupReady" }];
}

/** US-101 지도 기반 공실 탐색. 이 모듈은 화면 조립만 한다. */
export default function SpacesRoute() {
  const [search, setSearch] = useState<SpaceSearchState>(DEFAULT_SEARCH);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data, isPending, isError, isSettling } = useSpaceSearch(search);
  const spaces = useMemo(() => data ?? [], [data]);

  // 조건이 바뀌어 선택한 공실이 결과에서 빠지면 요약 카드도 비운다.
  const selected = spaces.find((space) => space.id === selectedId) ?? null;

  return (
    <main className="flex flex-col gap-4 px-6 py-6">
      <header>
        <h1 className="text-display">공간 찾기</h1>
        <p className="mt-2 text-caption text-text-muted">
          조건에 맞는 공실을 찾아 도면 배치 단계로 넘어갑니다.
        </p>
      </header>

      <SpaceFilters search={search} onChange={setSearch} />

      <div className="flex gap-6">
        <div className="flex-1">
          <SpaceResults
            spaces={spaces}
            selectedId={selectedId}
            onSelect={setSelectedId}
            isLoading={isPending || isSettling}
            isError={isError}
            center={{ lat: search.lat, lng: search.lng }}
            onCenterChange={(center) => setSearch((prev) => ({ ...prev, ...center }))}
          />
        </div>
        <SpaceSummaryPanel space={selected} />
      </div>
    </main>
  );
}
