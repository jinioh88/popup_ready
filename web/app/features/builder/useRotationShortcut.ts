import { useEffect } from "react";

import { useBuilderStore } from "../../stores/builder";
import { rotationRejectionMessage } from "./messages";
import type { FixtureCatalog } from "./queries";

/**
 * `R` 키로 **이미 배치된** 집기를 90도 회전한다(버튼과 같은 동작).
 * 입력 중에는 동작하지 않는다 — 폼에 'r'을 타이핑하는 것과 구분해야 한다.
 * 키보드 배치 초안이 떠 있으면 물러난다 — 그때 R은 초안의 것이다.
 */
export function useRotationShortcut(fixtures: FixtureCatalog, onRejected: (m: string) => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "r" && event.key !== "R") {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) {
        return;
      }

      const { selectedIndex, rotateItem, draft } = useBuilderStore.getState();

      // 키보드 배치 중이면 R은 **초안**을 돌린다(`useKeyboardPlacement`). 여기서도 처리하면
      // 한 번의 R이 초안과 선택된 집기를 함께 돌린다 — `placeItem`이 배치 직후 선택을
      // 남기므로 이 조합은 드문 경우가 아니라 기본 경로다.
      if (draft) {
        return;
      }

      if (selectedIndex === null) {
        return;
      }

      event.preventDefault();
      const result = rotateItem(selectedIndex, fixtures);

      if (!result.ok) {
        onRejected(rotationRejectionMessage(result.reason));
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fixtures, onRejected]);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
