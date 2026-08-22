import { apiRequest, type Schemas, type Unwrapped } from "./client";
import { spaceSummaryListSchema, type SpaceSummary } from "../schemas/api";

/** 공간 탐색·상세 (`GET /spaces` · `GET /spaces/{id}`). */

export type SpaceDetail = Unwrapped<Schemas["ApiResponseSpaceDetailResponse"]>;

export type SpaceSearchParams = {
  lat: number;
  lng: number;
  /** 반경(m). 생략하면 서버 기본값 1000. */
  radius?: number;
  minArea?: number;
  maxRent?: number;
  minPower?: number;
};

/** 목록은 핵심 응답 3종에 해당하므로 경계에서 Zod로 파싱한다. */
export async function searchSpaces(params: SpaceSearchParams): Promise<SpaceSummary[]> {
  const data = await apiRequest<unknown>("/spaces", { query: params });
  return spaceSummaryListSchema.parse(data);
}

/** 상세는 Zod 대상 3종이 아니다(전면 도입 금지) — 생성 타입으로만 받는다. */
export function getSpaceDetail(spaceId: number): Promise<SpaceDetail> {
  return apiRequest<SpaceDetail>(`/spaces/${spaceId}`);
}
