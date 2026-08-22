import { useBuilderStore } from "../../stores/builder";
import type { FixtureCatalog } from "./queries";

/** 선택된 집기에 대한 조작(회전·삭제). 회전은 `R` 키와 같은 동작이다. */
export function SelectionToolbar({
  fixtures,
  onRejected,
}: {
  fixtures: FixtureCatalog;
  onRejected: (message: string) => void;
}) {
  const selectedIndex = useBuilderStore((state) => state.selectedIndex);
  const items = useBuilderStore((state) => state.items);
  const rotateItem = useBuilderStore((state) => state.rotateItem);
  const removeItem = useBuilderStore((state) => state.removeItem);

  const selected = selectedIndex === null ? undefined : items[selectedIndex];
  const fixture = selected ? fixtures[selected.fixtureId] : undefined;

  if (selectedIndex === null || !selected || !fixture) {
    return (
      <p className="text-caption text-text-muted">
        집기를 캔버스로 끌어다 놓고, 배치된 집기를 선택하면 회전·삭제할 수 있습니다. (회전 단축키:
        R)
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <p className="text-caption text-text-muted">
        선택: <span className="text-text">{fixture.name}</span> · {selected.rotation}°
      </p>
      <button
        type="button"
        onClick={() => {
          const result = rotateItem(selectedIndex, fixtures);

          if (!result.ok) {
            onRejected(
              result.reason === "OVERLAP"
                ? "회전하면 다른 집기와 겹칩니다."
                : "회전하면 도면 범위를 벗어납니다.",
            );
          }
        }}
        className="h-10 rounded-lg border border-border bg-surface px-3 text-caption"
      >
        90° 회전 (R)
      </button>
      <button
        type="button"
        onClick={() => removeItem(selectedIndex)}
        className="h-10 rounded-lg border border-error px-3 text-caption text-error"
      >
        삭제
      </button>
    </div>
  );
}
