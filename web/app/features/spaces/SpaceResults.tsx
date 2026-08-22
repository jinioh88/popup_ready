import { SpaceListView } from "./SpaceListView";
import { SpaceMapView } from "./SpaceMapView";
import type { SpaceResultsProps } from "./searchState";

/**
 * 검색 결과 표시 경계.
 *
 * 키가 있으면 지도, 없으면 리스트 폴백이다. **두 뷰가 같은 props 계약을 구현**하므로 이 파일
 * 바깥(검색 조건·요약 카드·빌더 진입)은 어느 쪽이 렌더되든 달라지지 않는다.
 * 폴백을 남겨두는 이유는 키 없는 환경(CI·신규 개발자)에서도 화면이 동작해야 하기 때문이다.
 */

/** 빌드 타임 상수 — 키가 없으면 지도 코드가 번들에서 떨어져 나간다. */
const hasMapKey = Boolean(import.meta.env.VITE_KAKAO_MAP_KEY);

export function SpaceResults(props: SpaceResultsProps) {
  if (hasMapKey) {
    return <SpaceMapView {...props} />;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption text-text-muted">
        지도 키가 설정되지 않아 목록으로 표시합니다. (`VITE_KAKAO_MAP_KEY`)
      </p>
      <SpaceListView {...props} />
    </div>
  );
}
