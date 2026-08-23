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

  /**
   * 0은 "제한 없음"이다. 특히 `maxRent: 0`을 그대로 보내면 "0원 이하"라 반드시 빈 결과가
   * 나오고, 사용자는 그 뒤 어떤 필터를 만져도 결과가 안 바뀌는 상태에 갇힌다
   * (2026-08-23 인수 테스트에서 실제로 발생). 근거는 `toSearchParams` 주석.
   */
  it("0은 제한 없음으로 읽어 파라미터에서 뺀다", () => {
    const params = toSearchParams({ ...DEFAULT_SEARCH, minArea: 0, maxRent: 0, minPower: 0 });

    expect(params.minArea).toBeUndefined();
    expect(params.maxRent).toBeUndefined();
    expect(params.minPower).toBeUndefined();
  });

  it("0으로 내린 필터는 아무것도 넣지 않은 상태와 같은 요청이 된다", () => {
    const zeroed = toSearchParams({ ...DEFAULT_SEARCH, minArea: 0, maxRent: 0, minPower: 0 });

    expect(JSON.stringify(zeroed)).toBe(JSON.stringify(toSearchParams(DEFAULT_SEARCH)));
  });

  it("0이 아닌 값은 그대로 보낸다 — 해제 처리가 유효한 경계값까지 삼키면 안 된다", () => {
    const params = toSearchParams({ ...DEFAULT_SEARCH, minArea: 1, maxRent: 1, minPower: 1 });

    expect(params).toMatchObject({ minArea: 1, maxRent: 1, minPower: 1 });
  });
});

/**
 * 검색 조건 변경 감지는 **값** 기준이어야 한다(`useSpaceSearch`의 디바운스가 이 직렬화에
 * 의존한다). 참조 기준이면 같은 값을 되돌려 넣는 경로가 디바운스를 계속 되감아 필터가
 * 쿼리에 닿지 않는다 — 2026-08-23 인수 테스트의 "필터 되돌림 미동작" 조사에서 드러난 구멍이다.
 */
describe("toSearchParams 직렬화", () => {
  it("값이 같으면 객체가 달라도 같은 문자열이 된다", () => {
    const a = toSearchParams({ ...DEFAULT_SEARCH, minArea: 80 });
    const b = toSearchParams({ ...DEFAULT_SEARCH, minArea: 80 });

    expect(a).not.toBe(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("필터를 넣었다 지우면 처음과 같은 문자열로 돌아온다", () => {
    const before = JSON.stringify(toSearchParams(DEFAULT_SEARCH));
    const filtered = JSON.stringify(toSearchParams({ ...DEFAULT_SEARCH, maxRent: 300_000 }));
    const reverted = JSON.stringify(toSearchParams({ ...DEFAULT_SEARCH, maxRent: undefined }));

    expect(filtered).not.toBe(before);
    expect(reverted).toBe(before);
  });

  it("값이 하나라도 다르면 문자열도 달라진다", () => {
    const base = JSON.stringify(toSearchParams(DEFAULT_SEARCH));

    expect(JSON.stringify(toSearchParams({ ...DEFAULT_SEARCH, radius: 5000 }))).not.toBe(base);
    expect(JSON.stringify(toSearchParams({ ...DEFAULT_SEARCH, minArea: 80 }))).not.toBe(base);
  });
});

describe("AREA_PRESETS", () => {
  it("서로 다른 좌표를 가진다 — 프리셋 판별이 좌표 일치로 이뤄지기 때문", () => {
    const coords = AREA_PRESETS.map((preset) => `${preset.lat},${preset.lng}`);

    expect(new Set(coords).size).toBe(AREA_PRESETS.length);
  });
});
