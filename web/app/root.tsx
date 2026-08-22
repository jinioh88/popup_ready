import { useState, type ReactNode } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";

import type { Route } from "./+types/root";
import { createQueryClient } from "./lib/query/client";
import "./app.css";

export function links(): Route.LinkDescriptors {
  return [
    { rel: "preconnect", href: "https://cdn.jsdelivr.net" },
    {
      // 스타일가이드 §2 — Pretendard(가변, 동적 서브셋) CDN 로드.
      rel: "stylesheet",
      href: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css",
    },
  ];
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  // 클라이언트 인스턴스는 앱 생명주기 동안 하나만 유지한다.
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}

// SPA 모드에서 빌드 타임에 index.html로 렌더되는 초기 화면.
export function HydrateFallback() {
  return <p className="p-6 text-body text-text-muted">불러오는 중…</p>;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "오류가 발생했습니다";
  let detail = "알 수 없는 오류입니다.";

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : `${error.status}`;
    detail =
      error.status === 404 ? "요청하신 페이지를 찾을 수 없습니다." : error.statusText || detail;
  } else if (import.meta.env.DEV && error instanceof Error) {
    detail = error.message;
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-title">{message}</h1>
      <p className="mt-2 text-body text-text-muted">{detail}</p>
    </main>
  );
}
