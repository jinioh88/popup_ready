import { describe, expect, it } from "vitest";

import { fixtureDragType, readDraggedFixtureId } from "./dragTransfer";

/**
 * 이 규약이 깨지면 빌더에 집기를 아예 놓을 수 없다(사용자 인수 테스트에서 실제로 발생).
 *
 * 회귀의 핵심은 **판독 시점**이다 — dragover 단계의 dataTransfer는 protected mode라
 * `getData()`가 빈 문자열을 준다. 아래 스텁이 그 동작을 그대로 흉내 낸다.
 */

/** 실제 브라우저의 protected mode를 재현하는 dataTransfer 스텁. */
function dataTransferDuringDrag(types: string[]) {
  return {
    types,
    getData: (type: string) => {
      // 어떤 타입을 물어도 이 단계에서는 값이 가려진다 — 이것이 원래 버그의 원인이었다.
      void type;
      return "";
    },
  };
}

describe("readDraggedFixtureId", () => {
  it("dragover처럼 getData가 막힌 단계에서도 types만으로 집기 id를 읽는다", () => {
    const transfer = dataTransferDuringDrag(["chromium/x-drag-id", fixtureDragType(42)]);

    expect(transfer.getData(fixtureDragType(42))).toBe("");
    expect(readDraggedFixtureId(transfer.types)).toBe(42);
  });

  it("집기 드래그가 아니면 null이다 — 파일 드롭 등은 캔버스가 받지 않는다", () => {
    expect(readDraggedFixtureId(["Files", "text/plain"])).toBeNull();
  });

  it("types가 없어도 터지지 않는다", () => {
    expect(readDraggedFixtureId(undefined)).toBeNull();
    expect(readDraggedFixtureId([])).toBeNull();
  });

  it("접두사만 있고 id가 숫자가 아니면 우리 드래그로 보지 않는다", () => {
    expect(readDraggedFixtureId(["application/x-popupready-fixture-"])).toBeNull();
    expect(readDraggedFixtureId(["application/x-popupready-fixture-abc"])).toBeNull();
  });

  it("타입 이름은 소문자 ASCII만 쓴다 — 브라우저가 setData 타입을 소문자로 정규화한다", () => {
    const type = fixtureDragType(7);

    expect(type).toBe(type.toLowerCase());
    expect(readDraggedFixtureId([type])).toBe(7);
  });
});
