import { apiRequest } from "./client";
import type { FixtureAvailability } from "../builder/availability";
import { fixtureListSchema, type Fixture, type FixtureCategory } from "../schemas/api";

/** 집기 라이브러리 (`GET /fixtures`). 핵심 응답 3종이라 경계에서 Zod로 파싱한다. */
export async function listFixtures(category?: FixtureCategory): Promise<Fixture[]> {
  const data = await apiRequest<unknown>("/fixtures", { query: { category } });
  return fixtureListSchema.parse(data);
}

/**
 * 날짜별 집기 가용 수량 (`GET /spaces/{spaceId}/fixture-availability`).
 *
 * **인증이 필요하다** — 공간·집기 목록과 달리 예약 밀도를 드러내는 값이라 로그인 뒤에만 준다.
 * 토큰 없이 부르면 401이고, 공용 클라이언트가 그때 토큰을 비운다.
 *
 * 핵심 4종(+승인 1종)에 들지 않으므로 Zod 파싱은 붙이지 않는다 — 값이 어긋나도 팔레트의
 * 활성/비활성이 달라질 뿐이고, **최종 판정은 서버의 409 `FIXTURE_UNAVAILABLE`**이다.
 */
export async function getFixtureAvailability(
  spaceId: number,
  startDate: string,
  endDate: string,
): Promise<FixtureAvailability[]> {
  return apiRequest<FixtureAvailability[]>(`/spaces/${spaceId}/fixture-availability`, {
    query: { startDate, endDate },
  });
}
