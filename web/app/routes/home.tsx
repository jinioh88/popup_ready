import { Navigate } from "react-router";

/** 진입점은 지도 탐색(US-101)이다. SPA 모드라 서버 리다이렉트 대신 클라이언트에서 넘긴다. */
export default function Home() {
  return <Navigate to="/spaces" replace />;
}
