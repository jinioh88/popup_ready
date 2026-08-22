import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

/**
 * 개발 환경에서만 MSW 목업 워커를 띄운 뒤 앱을 하이드레이트한다.
 *
 * 첫 화면의 요청이 워커 등록보다 먼저 나가면 목업을 통과해 실제 네트워크로 새므로,
 * 워커 시작을 기다린 다음 렌더한다.
 *
 * `VITE_USE_MOCK_API=false`면 워커를 띄우지 않는다 — 그러면 요청이 dev 서버의 `/api` 프록시를
 * 지나 실제 백엔드로 간다. **통합은 이 환경변수 하나로 전환한다.** 전 구간이 실 API로 넘어가면
 * 이 블록과 `app/mocks/`를 지우는 것으로 마무리한다.
 */
async function startMockWorker() {
  if (!import.meta.env.DEV || import.meta.env.VITE_USE_MOCK_API === "false") {
    return;
  }

  const { worker } = await import("./mocks/browser");

  await worker.start({
    // 목업하지 않은 요청(정적 자산 등)은 그대로 통과시킨다.
    onUnhandledRequest: "bypass",
    serviceWorker: { url: "/mockServiceWorker.js" },
  });
}

startMockWorker().finally(() => {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <HydratedRouter />
      </StrictMode>,
    );
  });
});
