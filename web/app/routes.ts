import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

/**
 * 실서비스 라우트 골격 (sprint1-web.md A-2).
 *
 * 라우트 모듈은 화면 조립과 코드 스플리팅 경계만 담당한다 — 계산·페칭 로직을 두지 않는다.
 * SPA 모드이므로 서버 `loader`/`action`은 쓰지 않는다.
 */
export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("signup", "routes/signup.tsx"),

  // 인증 보호 구간. 가드 로직 자체는 C-5에서 채운다.
  layout("routes/protected-layout.tsx", [
    route("spaces", "routes/spaces.tsx"),
    route("spaces/:spaceId/builder", "routes/builder.tsx"),
    route("reservations/:reservationId/contract", "routes/contract.tsx"),
    route("reservations/:reservationId/payment", "routes/payment.tsx"),
  ]),
] satisfies RouteConfig;
