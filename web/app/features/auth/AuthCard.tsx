import type { ReactNode } from "react";
import { Link } from "react-router";

type AuthCardProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer: { text: string; linkLabel: string; to: string };
};

/** 로그인·가입 화면 공통 셸. 카드 radius 12, 화면 좌우 패딩 24 (스타일가이드 §3). */
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <h1 className="text-title">{title}</h1>
        <p className="mt-2 text-caption text-text-muted">{description}</p>
        <div className="mt-6">{children}</div>
        <p className="mt-6 text-caption text-text-muted">
          {footer.text}{" "}
          <Link to={footer.to} className="text-primary">
            {footer.linkLabel}
          </Link>
        </p>
      </div>
    </main>
  );
}
