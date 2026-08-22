import type { SpaceSummary } from "../../lib/schemas/api";
import { SpaceListView } from "./SpaceListView";

/**
 * 검색 결과 표시 경계.
 *
 * **Kakao Maps 키가 없어 지금은 리스트 폴백만 렌더한다**(sprint1.md §8 합의). 키가 발급되면
 * 이 컴포넌트 안에서 지도 뷰를 고르게 되고, 바깥(검색 조건·요약 카드·빌더 진입)은 그대로다.
 * 지도와 리스트가 같은 props(`spaces`·`selectedId`·`onSelect`)를 쓰도록 경계를 얇게 유지한다.
 */

export type SpaceResultsProps = {
  spaces: SpaceSummary[];
  selectedId: number | null;
  onSelect: (spaceId: number) => void;
  isLoading: boolean;
  isError: boolean;
};

/** 키가 들어오면 여기만 true가 되고 지도 뷰가 붙는다. */
const hasMapKey = Boolean(import.meta.env.VITE_KAKAO_MAP_KEY);

export function SpaceResults(props: SpaceResultsProps) {
  return (
    <div className="flex flex-col gap-2">
      {!hasMapKey ? (
        <p className="text-caption text-text-muted">
          지도 키가 설정되지 않아 목록으로 표시합니다. (`VITE_KAKAO_MAP_KEY`)
        </p>
      ) : null}
      <SpaceListView {...props} />
    </div>
  );
}
