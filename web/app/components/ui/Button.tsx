import type { ComponentPropsWithRef, ElementType } from "react";

/**
 * 주/보조/파괴적 버튼 (디자인 시스템 기본 4종, sprint2-web.md T0-1).
 *
 * Sprint 1 종료 시점 실측으로 주 버튼이 6곳에서 4갈래로 갈라져 있었고, `disabled` 시각 규격은
 * 그중 2곳에만 붙어 있었다. **높이·radius·disabled 처리를 여기서 한 번만 정한다.**
 *
 * 크기 prop을 두지 않는다 — 스타일가이드 §4가 웹 버튼 높이를 40 하나로 못박았다.
 * 값이 필요해지면 토큰을 늘리기 전에 PM과 협의한다.
 *
 * `as`로 요소를 바꿀 수 있다(`Card`와 같은 패턴). 네 갈래 중 하나가 "버튼처럼 보이는 링크"
 * (`SpaceSummaryPanel`의 '선택 완료')였는데, 그것만 남겨두면 색·높이의 두 번째 원천이 된다.
 * **다만 앵커는 `disabled`가 없다** — 비활성이 필요한 동작은 링크가 아니라 버튼이어야 한다.
 */

export type ButtonVariant = "primary" | "secondary" | "destructive";

type ButtonOwnProps<T extends ElementType> = {
  as?: T;
  variant?: ButtonVariant;
  /** 레이아웃 전용 추가 클래스(예: `w-full`, `mt-4`). 색·높이·radius를 덮어쓰지 않는다. */
  className?: string;
};

type ButtonProps<T extends ElementType> = ButtonOwnProps<T> &
  Omit<ComponentPropsWithRef<T>, keyof ButtonOwnProps<T>>;

/** 스타일가이드 §4 — 높이 40, radius 8. 주 버튼은 화면당 1개. */
const BASE =
  "inline-flex h-10 items-center justify-center rounded-lg px-4 text-body-strong transition-colors disabled:cursor-not-allowed disabled:opacity-60";

/**
 * hover는 **`enabled:`로 잠근다.** CSS `:hover`는 disabled 버튼에도 매칭되므로 그냥 두면
 * 한도 초과로 잠긴 결제 버튼이 마우스를 올릴 때 진하게 변해 눌리는 것처럼 보인다.
 * disabled의 시각적 약속(opacity-60 + not-allowed 커서)을 hover가 되돌리는 셈이다.
 * Sprint 1의 흩어진 버튼들이 전부 이 상태였고, 여기로 모으는 지금이 고칠 자리다.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white enabled:hover:bg-primary-dark",
  secondary: "border border-border bg-surface text-text enabled:hover:bg-bg",
  destructive:
    "border border-error bg-surface text-error enabled:hover:bg-error enabled:hover:text-white",
};

export function Button<T extends ElementType = "button">({
  as,
  variant = "primary",
  className,
  ...props
}: ButtonProps<T>) {
  const Component = (as ?? "button") as ElementType;

  // `type`을 지정하지 않은 버튼은 폼 안에서 submit으로 동작한다 — 취소·삭제 버튼이
  // 폼을 제출해 버리는 사고를 막기 위해 기본값을 button으로 둔다. 앵커·Link에는 붙이지 않는다.
  const typeProp =
    Component === "button" ? { type: (props as { type?: string }).type ?? "button" } : null;

  return (
    <Component
      className={`${BASE} ${VARIANTS[variant]} ${className ?? ""}`}
      {...props}
      {...typeProp}
    />
  );
}
