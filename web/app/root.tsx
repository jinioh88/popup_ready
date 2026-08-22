import type { ReactNode } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

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
  return <Outlet />;
}

// SPA 모드에서 빌드 타임에 index.html로 렌더되는 초기 화면.
export function HydrateFallback() {
  return <p>불러오는 중…</p>;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "오류가 발생했습니다";
  let detail = "알 수 없는 오류입니다.";

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : `${error.status}`;
    detail =
      error.status === 404
        ? "요청하신 페이지를 찾을 수 없습니다."
        : error.statusText || detail;
  } else if (import.meta.env.DEV && error instanceof Error) {
    detail = error.message;
  }

  return (
    <main>
      <h1>{message}</h1>
      <p>{detail}</p>
    </main>
  );
}
