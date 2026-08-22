import { describe, expect, it } from "vitest";

import { AREA_PRESETS, DEFAULT_SEARCH, toSearchParams } from "./searchState";

/**
 * 쿼리 파라미터 이름은 계약(sprint1.md §2.2 `GET /spaces`)이다 —
 * lat·lng·radius·minArea·maxRent·minPower. 이름이 바뀌면 서버가 필터를 무시해
 * "필터가 안 먹는다"는 형태로만 드러나므로 여기서 못 박는다.
 */
describe("toSearchParams", () => {
  it("좌표와 반경은 항상 보낸다", () => {
    expect(toSearchParams(DEFAULT_SEARCH)).toMatchObject({
      lat: DEFAULT_SEARCH.lat,
      lng: DEFAULT_SEARCH.lng,
      radius: DEFAULT_SEARCH.radius,
    });
  });

  it("비어 있는 필터는 undefined로 남겨 쿼리에서 빠지게 한다", () => {
    const params = toSearchParams(DEFAULT_SEARCH);

    expect(params.minArea).toBeUndefined();
    expect(params.maxRent).toBeUndefined();
    expect(params.minPower).toBeUndefined();
  });

  it("채워진 필터는 계약상 이름 그대로 실어 보낸다", () => {
    const params = toSearchParams({
      ...DEFAULT_SEARCH,
      minArea: 30,
      maxRent: 250_000,
      minPower: 3000,
    });

    expect(params).toEqual({
      lat: DEFAULT_SEARCH.lat,
      lng: DEFAULT_SEARCH.lng,
      radius: DEFAULT_SEARCH.radius,
      minArea: 30,
      maxRent: 250_000,
      minPower: 3000,
    });
  });

  it("0은 유효한 필터 값이라 빠뜨리지 않는다", () => {
    expect(toSearchParams({ ...DEFAULT_SEARCH, minPower: 0 }).minPower).toBe(0);
  });
});

describe("AREA_PRESETS", () => {
  it("서로 다른 좌표를 가진다 — 프리셋 판별이 좌표 일치로 이뤄지기 때문", () => {
    const coords = AREA_PRESETS.map((preset) => `${preset.lat},${preset.lng}`);

    expect(new Set(coords).size).toBe(AREA_PRESETS.length);
  });
});
