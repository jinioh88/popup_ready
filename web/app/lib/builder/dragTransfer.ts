/**
 * 집기 드래그의 dataTransfer 규약 (US-102).
 *
 * **`dragover`에서는 페이로드를 읽을 수 없다.** HTML5 DnD 명세상 드래그가 진행 중인 동안
 * drag data store는 *protected mode*라 `dataTransfer.types`만 노출되고 `getData()`는 항상
 * 빈 문자열을 돌려준다(실제 Chrome 로그로 확인: types에는 커스텀 타입이 있는데 getData는 `""`).
 * 페이로드가 읽히는 시점은 `dragstart`와 `drop`뿐이다.
 *
 * 그래서 **집기 id를 값이 아니라 타입 이름에 싣는다** — `types`는 어느 단계에서든 읽히므로
 * 드래그 미리보기(dragover)와 실제 드롭이 같은 출처를 보게 된다. 컴포넌트 사이에 "지금 끌고
 * 있는 집기" 같은 가변 상태를 따로 두지 않아도 되고, 드래그 취소 시 남는 찌꺼기도 없다.
 *
 * 브라우저는 `setData`의 타입 문자열을 소문자로 정규화하므로 접두사는 소문자 ASCII만 쓴다.
 */

/** 집기 드래그임을 식별하는 타입 접두. 뒤에 집기 id가 붙는다. */
const FIXTURE_DRAG_TYPE_PREFIX = "application/x-popupready-fixture-";

/** `dragstart`에서 dataTransfer에 실을 타입 이름. */
export function fixtureDragType(fixtureId: number): string {
  return `${FIXTURE_DRAG_TYPE_PREFIX}${fixtureId}`;
}

/**
 * `dataTransfer.types`에서 끌고 있는 집기 id를 읽는다. 집기 드래그가 아니면 null.
 *
 * dragover·drop 양쪽에서 같은 함수를 쓴다 — 한쪽만 다른 경로로 읽으면 "미리보기는 뜨는데
 * 드롭이 안 된다" 같은 어긋남이 생긴다.
 */
export function readDraggedFixtureId(types: readonly string[] | undefined): number | null {
  if (!types) {
    return null;
  }

  for (const type of types) {
    if (!type.startsWith(FIXTURE_DRAG_TYPE_PREFIX)) {
      continue;
    }

    const raw = type.slice(FIXTURE_DRAG_TYPE_PREFIX.length);

    // 접두사만 있고 id가 없거나 숫자가 아니면 우리 드래그가 아니다.
    if (!/^\d+$/.test(raw)) {
      continue;
    }

    return Number(raw);
  }

  return null;
}
