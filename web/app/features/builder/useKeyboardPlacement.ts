import { useEffect } from "react";

import { placementRejectionMessage } from "./messages";
import type { FixtureCatalog } from "./queries";
import { useBuilderStore } from "../../stores/builder";

/**
 * 키보드 배치 조작 (I-1, Sprint 1 §5.1-2 이월 · PM 우선순위 상향).
 *
 * 집기 팔레트가 HTML5 드래그 전용이라 키보드로는 배치가 **불가능**했다. 드래그를 대체하는 게
 * 아니라 두 번째 경로를 여는 것이며, **판정은 드래그와 같은 함수를 쓴다**(`placeItem`).
 *
 *   방향키   초안을 셀 단위로 옮긴다
 *   R        확정 전 90도 회전
 *   Enter    확정
 *   Esc      취소
 *
 * 초안이 없을 때는 아무 키도 가로채지 않는다 — 기존 `useRotationShortcut`(배치된 집기의 R)과
 * 겹치지 않게 하려면 이쪽이 초안이 있을 때만 동작해야 한다.
 */

const ARROW_DELTAS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function useKeyboardPlacement(
  fixtures: FixtureCatalog,
  onRejected: (message: string) => void,
) {
  const draft = useBuilderStore((state) => state.draft);

  useEffect(() => {
    if (!draft) {
      return;
    }

    function handle(event: KeyboardEvent) {
      // 폼 입력 중에는 방향키가 커서 이동이어야 한다. 예약 기간 입력이 같은 화면에 있다.
      // 수정자 키 조합은 브라우저·OS 단축키다(⌘←는 뒤로 가기 등) — 가로채지 않는다.
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const store = useBuilderStore.getState();
      const delta = ARROW_DELTAS[event.key];

      if (delta) {
        // 방향키는 페이지 스크롤을 일으킨다 — 배치 중에는 도면이 따라 움직이면 안 된다.
        event.preventDefault();
        store.moveDraft(delta[0], delta[1]);
        return;
      }

      if (event.key === "r" || event.key === "R") {
        event.preventDefault();
        store.rotateDraft();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const check = store.commitDraft(fixtures);

        if (!check.ok) {
          // 거부해도 초안은 남는다 — 사유를 보고 옮겨서 다시 시도할 수 있어야 한다.
          onRejected(placementRejectionMessage(check.reason));
        }

        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        store.cancelDraft();
      }
    }

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [draft, fixtures, onRejected]);
}

/** 입력 요소에 포커스가 있으면 그쪽이 키를 가져간다. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}
