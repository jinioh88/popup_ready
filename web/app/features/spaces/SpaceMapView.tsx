import { useEffect, useState } from "react";
import { Map, MapMarker, useKakaoLoader } from "react-kakao-maps-sdk";

import { SpaceListView } from "./SpaceListView";
import type { SpaceResultsProps } from "./searchState";

/**
 * Kakao Maps 지도 뷰 (US-101).
 *
 * 리스트 폴백과 **같은 props 계약**을 구현한다 — 마커 클릭은 리스트 항목 선택과 같은 동작이고,
 * 선택 결과는 바깥의 우측 요약 카드가 받는다.
 *
 * SDK는 카카오 개발자 콘솔에 **등록된 사이트 도메인에서만** 로드된다. 거부되면 SDK 로더가
 * 실패를 알려주지 않고 무한 재시도하므로(로그에 "retrying"만 남는다), 일정 시간이 지나면
 * **리스트 폴백으로 떨어뜨린다** — 화면이 "불러오는 중"에 갇히는 것보다 낫고, 폴백은 어차피
 * 키 없는 환경을 위해 유지하는 경로다.
 */

/** 이 시간 안에 SDK가 올라오지 않으면 폴백으로 전환한다. */
const SDK_TIMEOUT_MS = 6000;
export function SpaceMapView({
  spaces,
  selectedId,
  onSelect,
  isLoading,
  isError,
  center,
  onCenterChange,
}: SpaceResultsProps) {
  const props = { spaces, selectedId, onSelect, isError, center, onCenterChange };
  const [loading, error] = useKakaoLoader({
    appkey: import.meta.env.VITE_KAKAO_MAP_KEY ?? "",
  });
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      return;
    }

    const timer = setTimeout(() => setTimedOut(true), SDK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  if (error || timedOut) {
    return (
      <div className="flex flex-col gap-2">
        <p className="rounded-xl border border-warning p-4 text-caption">
          지도 SDK를 불러오지 못해 목록으로 표시합니다. 카카오 개발자 콘솔의{" "}
          <b>내 애플리케이션 &gt; 플랫폼 &gt; Web 사이트 도메인</b>에 현재 주소(
          {typeof window === "undefined" ? "" : window.location.origin})가 등록돼 있어야 합니다.
        </p>
        <SpaceListView {...props} isLoading={false} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {isError ? <p className="text-caption text-error">공실 목록을 불러오지 못했습니다.</p> : null}

      <div className="h-[540px] w-full overflow-hidden rounded-xl border border-border">
        {loading ? (
          <p className="p-4 text-caption text-text-muted">지도를 불러오는 중…</p>
        ) : (
          <Map
            center={center}
            level={5}
            style={{ width: "100%", height: "100%" }}
            // 지도 이동·줌이 곧 검색 조건이다. 호출 폭주는 바깥의 디바운스가 막는다.
            onCenterChanged={(map) => {
              const next = map.getCenter();
              onCenterChange({ lat: next.getLat(), lng: next.getLng() });
            }}
          >
            {spaces.map((space) => (
              <MapMarker
                key={space.id}
                position={space.location}
                title={space.name}
                onClick={() => onSelect(space.id)}
              />
            ))}
          </Map>
        )}
      </div>

      {/*
        결과가 0건일 때 지도는 그냥 빈 지도라 **이유를 말해주지 않는다** — 리스트 폴백에만
        안내가 있어서, 필터를 잘못 좁힌 사용자가 "검색이 고장났다"로 읽었다
        (2026-08-23 인수 테스트). 조건 때문이라는 것과 다음 행동을 같이 알려준다.
      */}
      {!isLoading && !isError && spaces.length === 0 ? (
        <p className="text-caption text-text-muted">
          조건에 맞는 공실이 없습니다. 반경을 넓히거나 필터를 완화해 보세요.
        </p>
      ) : null}

      <p className="text-caption text-text-muted">
        마커 {spaces.length}개 · 지도를 움직이면 그 중심으로 다시 찾습니다.
        {selectedId === null ? " 마커를 클릭하면 요약 정보가 표시됩니다." : ""}
      </p>
    </div>
  );
}
