import { useParams } from "react-router";

export function meta() {
  return [{ title: "매장 배치 · PopupReady" }];
}

/** US-102 2D 가상 매장 빌더. 그리드 렌더·드래그·스냅·충돌은 Phase D~E에서 채운다. */
export default function BuilderRoute() {
  const { spaceId } = useParams();

  return (
    <main className="px-6 py-6">
      <h1 className="text-display">매장 배치</h1>
      <p className="mt-2 text-body text-text-muted">
        상가 #{spaceId}의 도면 그리드에 집기를 배치합니다. (US-102 — Phase D~E)
      </p>
    </main>
  );
}
