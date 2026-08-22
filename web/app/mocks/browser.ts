import { setupWorker } from "msw/browser";

import { handlers } from "./handlers";

/** 브라우저용 목업 워커. 개발 환경에서만 `app/entry.client.tsx`가 시작한다. */
export const worker = setupWorker(...handlers);
