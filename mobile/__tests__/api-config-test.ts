import { API_PREFIX, resolveApiBaseUrl } from "../src/lib/api/config";

describe("resolveApiBaseUrl", () => {
  it("hostUri의 호스트만 떼어 8080 베이스 URL을 만든다", () => {
    expect(resolveApiBaseUrl("192.168.0.10:8081")).toBe(`http://192.168.0.10:8080${API_PREFIX}`);
  });

  it("hostUri에 경로가 붙어 있어도 호스트만 쓴다", () => {
    expect(resolveApiBaseUrl("192.168.0.10:8081/_expo")).toBe(
      `http://192.168.0.10:8080${API_PREFIX}`,
    );
  });

  it("명시 URL이 hostUri보다 우선한다", () => {
    expect(resolveApiBaseUrl("192.168.0.10:8081", "http://10.0.2.2:8080")).toBe(
      `http://10.0.2.2:8080${API_PREFIX}`,
    );
  });

  it("명시 URL의 끝 슬래시를 중복시키지 않는다", () => {
    expect(resolveApiBaseUrl(undefined, "http://10.0.2.2:8080/")).toBe(
      `http://10.0.2.2:8080${API_PREFIX}`,
    );
  });

  // localhost 폴백은 실기기에서 기기 자신을 가리켜 조용히 실패한다. 오류로 드러내야 한다.
  it("주소를 못 구하면 null을 돌려준다", () => {
    expect(resolveApiBaseUrl(undefined, undefined)).toBeNull();
    expect(resolveApiBaseUrl("")).toBeNull();
  });
});
