import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * 가드의 가드 — 새 화면이 **어느 가드도 지나지 않는** 상태로 추가되는 것을 막는다.
 *
 * `_layout.tsx`에 등록하지 않은 라우트 파일을 expo-router가 자동으로 네비게이터에 추가하기
 * 때문에, 화면을 추가하면서 `Stack.Protected`에 넣는 것을 잊으면 그 화면은 조용히 무방비로
 * 열린다. 사람이 리뷰에서 잡기를 기대하는 대신 여기서 깨지게 한다.
 */
const APP_DIR = join(__dirname, "..", "src", "app");
const LAYOUT = join(APP_DIR, "_layout.tsx");

/** `src/app` 아래 라우트 파일 → expo-router가 쓰는 라우트 이름. */
function routeNames(dir: string = APP_DIR): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return routeNames(full);
    if (!/\.tsx?$/.test(entry) || entry.startsWith("_")) return [];
    return [relative(APP_DIR, full).replace(/\.tsx?$/, "")];
  });
}

/** `<Stack.Protected …> … </Stack.Protected>` 블록 안쪽 내용만 모은다. */
function guardedSections(source: string): string {
  return [...source.matchAll(/<Stack\.Protected[\s\S]*?<\/Stack\.Protected>/g)]
    .map((match) => match[0])
    .join("\n");
}

describe("라우트 가드 커버리지", () => {
  const layoutSource = readFileSync(LAYOUT, "utf8");
  const guarded = guardedSections(layoutSource);
  const routes = routeNames();

  it("검사 대상 라우트를 실제로 찾아낸다", () => {
    // 경로 규칙이 바뀌어 목록이 비면 아래 테스트가 조용히 통과한다 — 그것부터 막는다.
    expect(routes).toContain("index");
    expect(routes).toContain(join("reservations", "index"));
  });

  it.each(routeNames())("%s 라우트가 Stack.Protected 안에 등록돼 있다", (route) => {
    const name = route.split(/[\\/]/).join("/");
    expect(guarded).toContain(`name="${name}"`);
  });
});
