import { Link, Outlet } from "react-router";

/**
 * 인증 보호 구간 레이아웃.
 *
 * 토큰 부재 시 `/login` 리다이렉트하는 가드는 C-5에서 채운다
 * (토큰 보관 위치가 B-5에서 확정된 뒤라야 한다).
 */
export default function ProtectedLayout() {
  return (
    <div className="min-h-dvh">
      <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-6">
        <Link to="/spaces" className="text-heading text-primary">
          PopupReady
        </Link>
      </header>
      <Outlet />
    </div>
  );
}
