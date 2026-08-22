import { apiRequest } from "./client";
import { fixtureListSchema, type Fixture, type FixtureCategory } from "../schemas/api";

/** 집기 라이브러리 (`GET /fixtures`). 핵심 응답 3종이라 경계에서 Zod로 파싱한다. */
export async function listFixtures(category?: FixtureCategory): Promise<Fixture[]> {
  const data = await apiRequest<unknown>("/fixtures", { query: { category } });
  return fixtureListSchema.parse(data);
}
