import { useEffect } from "react";

import { useBuilderStore } from "../../stores/builder";
import { rotationRejectionMessage } from "./messages";
import type { FixtureCatalog } from "./queries";

/**
 * `R` 키로 선택된 집기를 90도 회전한다(버튼과 같은 동작).
 * 입력 중에는 동작하지 않는다 — 폼에 'r'을 타이핑하는 것과 구분해야 한다.
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

      const { selectedIndex, rotateItem } = useBuilderStore.getState();

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
