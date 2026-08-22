import { type RouteConfig, index, route } from "@react-router/dev/routes";

// 프레임워크 모드 배선 확인용 최소 골격. 실제 서비스 라우트 설계는 별도 진행.
export default [
  index("routes/home.tsx"),
  route("about", "routes/about.tsx"),
] satisfies RouteConfig;
