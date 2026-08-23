import type { ComponentPropsWithRef, ElementType } from "react";

/**
 * 카드 표면 (디자인 시스템 기본 4종, sprint2-web.md T0-1).
 *
 * Sprint 1 실측에서 `p-6` 2곳 / `p-4` 5곳으로 갈라져 있었다. **두 값을 그대로 흡수하고
 * 세 번째 값을 만들지 않는다** — 필요해 보이면 간격 토큰(§3) 문제이므로 PM과 협의한다.
 *
 * `as`로 시맨틱 요소를 바꿀 수 있다(`article` `aside` `section` `form`). 카드는 시각 규격이지
 * 문서 구조가 아니므로 항상 `div`로 감싸면 스크린리더에서 구조가 뭉개진다.
 */

export type CardPadding = "md" | "lg";

type CardProps<T extends ElementType> = {
  as?: T;
  /** md=16 / lg=24 (스타일가이드 §3 간격 4배수). */
  padding?: CardPadding;
  className?: string;
} & Omit<ComponentPropsWithRef<T>, "as" | "className">;

/** 스타일가이드 §3 — 카드 radius 12. */
const BASE = "rounded-xl border border-border bg-surface";

const PADDINGS: Record<CardPadding, string> = {
  md: "p-4",
  lg: "p-6",
};

export function Card<T extends ElementType = "div">({
  as,
  padding = "md",
  className,
  ...props
}: CardProps<T>) {
  const Component = (as ?? "div") as ElementType;

  return <Component className={`${BASE} ${PADDINGS[padding]} ${className ?? ""}`} {...props} />;
}
