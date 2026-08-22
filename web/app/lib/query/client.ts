import { QueryClient } from "@tanstack/react-query";

/**
 * TanStack Query 기본 설정.
 *
 * SPA 모드라 서버 `loader`를 쓰지 않으므로 데이터 페칭은 전부 이 클라이언트를 거친다
 * (이중 캐시 방지 — web/CLAUDE.md "상태 관리 분담").
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 지도 이동마다 재요청이 튀지 않도록 짧은 신선도를 둔다(US-101 디바운스와 별개).
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}
