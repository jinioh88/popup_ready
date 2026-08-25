import { Link, Navigate, Outlet, useLocation } from "react-router";

import { useAccessToken } from "../features/auth/useSession";
import { clearSession } from "../lib/api/token";

/**
 * 인증 보호 구간 레이아웃 (C-5).
 *
 * SPA 모드라 서버 리다이렉트가 없다 — 토큰이 없으면 클라이언트에서 `/login`으로 보낸다.
 * 이 가드는 화면 노출만 막는다. **실제 접근 통제는 서버의 몫이며**, 토큰 없이 부른 API는
 * 401로 떨어진다.
 */
export default function ProtectedLayout() {
  const location = useLocation();
  // **구독해서 본다** — 뮤테이션 도중 401로 토큰이 비워지면 그 순간 여기가 다시 판정한다(§8.6).
  const accessToken = useAccessToken();

  if (!accessToken) {
    // 로그인 후 원래 가려던 곳으로 되돌리기 위해 위치를 실어 보낸다.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="min-h-dvh">
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-6">
        <Link to="/spaces" className="text-heading text-primary">
          PopupReady
        </Link>
        <button
          type="button"
          onClick={() => {
            clearSession();
            // 클라이언트 라우팅이 아니라 전체 리로드다. 가드를 다시 평가시키는 것도 있지만,
            // 메모리에 남은 빌더 배치(Zustand)까지 함께 버리기 위해서다 — 공용 PC에서
            // 이전 사용자의 도면 초안이 다음 사용자에게 남으면 안 된다.
            window.location.assign("/login");
          }}
          className="text-caption text-text-muted"
        >
          로그아웃
        </button>
      </header>
      <Outlet />
    </div>
  );
}
