import type { SpaceResultsProps } from "./SpaceResults";

/** 지도 폴백 목록. 항목 선택은 지도의 마커 클릭과 같은 동작이다(우측 요약 카드 노출). */
export function SpaceListView({
  spaces,
  selectedId,
  onSelect,
  isLoading,
  isError,
}: SpaceResultsProps) {
  if (isError) {
    return <p className="text-body text-error">공실 목록을 불러오지 못했습니다.</p>;
  }

  if (isLoading) {
    return <p className="text-body text-text-muted">공실을 찾는 중…</p>;
  }

  if (spaces.length === 0) {
    return (
      <p className="text-body text-text-muted">
        조건에 맞는 공실이 없습니다. 반경을 넓히거나 필터를 완화해 보세요.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {spaces.map((space) => {
        const selected = space.id === selectedId;

        return (
          <li key={space.id}>
            <button
              type="button"
              onClick={() => onSelect(space.id)}
              aria-current={selected ? "true" : undefined}
              className={`w-full rounded-xl border p-4 text-left ${
                selected ? "border-primary bg-primary-light" : "border-border bg-surface"
              }`}
            >
              <p className="text-body-strong">{space.name}</p>
              <p className="mt-1 text-caption text-text-muted">{space.address}</p>
              <p className="mt-2 text-caption text-text-muted">
                {space.dailyRent.toLocaleString("ko-KR")}원/일 · {space.floorAreaM2}㎡ ·{" "}
                {space.maxPowerWatt.toLocaleString("ko-KR")}W
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
