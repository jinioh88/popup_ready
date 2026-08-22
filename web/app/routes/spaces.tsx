export function meta() {
  return [{ title: "공간 찾기 · PopupReady" }];
}

/** US-101 지도 기반 공실 탐색. 지도·필터·요약 카드는 Phase C에서 채운다. */
export default function SpacesRoute() {
  return (
    <main className="px-6 py-6">
      <h1 className="text-display">공간 찾기</h1>
      <p className="mt-2 text-body text-text-muted">
        지도에서 공실 상가를 탐색합니다. (US-101 — Phase C)
      </p>
    </main>
  );
}
