import type { ComponentPropsWithRef } from "react";

/**
 * 주/보조/파괴적 버튼 (디자인 시스템 기본 4종, sprint2-web.md T0-1).
 *
 * Sprint 1 종료 시점 실측으로 주 버튼이 6곳에서 4갈래로 갈라져 있었고, `disabled` 시각 규격은
 * 그중 2곳에만 붙어 있었다. **높이·radius·disabled 처리를 여기서 한 번만 정한다.**
 *
 * 크기 prop을 두지 않는다 — 스타일가이드 §4가 웹 버튼 높이를 40 하나로 못박았다.
 * 값이 필요해지면 토큰을 늘리기 전에 PM과 협의한다.
 */

export type ButtonVariant = "primary" | "secondary" | "destructive";

type ButtonProps = Omit<ComponentPropsWithRef<"button">, "className"> & {
  variant?: ButtonVariant;
  /** 레이아웃 전용 추가 클래스(예: `w-full`, `mt-4`). 색·높이·radius를 덮어쓰지 않는다. */
  className?: string;
};

/** 스타일가이드 §4 — 높이 40, radius 8. 주 버튼은 화면당 1개. */
const BASE =
  "inline-flex h-10 items-center justify-center rounded-lg px-4 text-body-strong transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-dark",
  secondary: "border border-border bg-surface text-text hover:bg-bg",
  destructive: "border border-error bg-surface text-error hover:bg-error hover:text-white",
};

export function Button({ variant = "primary", className, type, ...props }: ButtonProps) {
  return (
    // `type`을 지정하지 않은 버튼은 폼 안에서 submit으로 동작한다 — 취소·삭제 버튼이
    // 폼을 제출해 버리는 사고를 막기 위해 기본값을 button으로 둔다.
    <button
      type={type ?? "button"}
      className={`${BASE} ${VARIANTS[variant]} ${className ?? ""}`}
      {...props}
    />
  );
}
