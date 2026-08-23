import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

/**
 * 전 구간이 실 API로 넘어가 목업(MSW)은 걷어냈다(G-3, 2026-08-23).
 * 개발 중 요청은 dev 서버의 `/api` 프록시를 지나 백엔드로 간다(`vite.config.ts`).
 */
startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>,
  );
});
