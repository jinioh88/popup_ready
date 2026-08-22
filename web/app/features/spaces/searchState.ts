import type { SpaceSearchParams } from "../../lib/api/spaces";

/**
 * 공실 탐색 검색 조건.
 *
 * **지도와 리스트 폴백이 같은 조건을 공유한다.** 지도가 붙으면 중심 좌표를 지도 이동에서 받고,
 * 지금은 지역 프리셋에서 받는다 — `GET /spaces` 호출 형태는 양쪽이 동일하다.
 */

export type SearchCenter = {
  lat: number;
  lng: number;
};

export type SpaceSearchState = SearchCenter & {
  radius: number;
  minArea?: number;
  maxRent?: number;
  minPower?: number;
};

/** Kakao 키 발급 전 중심 좌표를 고르는 수단. 지도가 붙으면 지도 중심이 이 자리를 대신한다. */
export const AREA_PRESETS = [
  { id: "seongsu", label: "성수", lat: 37.5445, lng: 127.0557 },
  { id: "myeongdong", label: "명동", lat: 37.5636, lng: 126.9826 },
  { id: "hongdae", label: "홍대", lat: 37.5551, lng: 126.9236 },
] as const;

export const RADIUS_OPTIONS = [500, 1000, 2000, 5000] as const;

export const DEFAULT_SEARCH: SpaceSearchState = {
  lat: AREA_PRESETS[0].lat,
  lng: AREA_PRESETS[0].lng,
  radius: 1000,
};

/** 검색 상태 → API 쿼리 파라미터. 비어 있는 필터는 보내지 않는다. */
export function toSearchParams(state: SpaceSearchState): SpaceSearchParams {
  return {
    lat: state.lat,
    lng: state.lng,
    radius: state.radius,
    minArea: state.minArea,
    maxRent: state.maxRent,
    minPower: state.minPower,
  };
}
