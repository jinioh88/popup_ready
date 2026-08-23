import type { ReactNode } from "react";

/**
 * 상태 뱃지 (디자인 시스템 기본 4종, sprint2-web.md T0-1).
 *
 * 예약·계약·정산·집기 가용성 상태가 Sprint 2에 한꺼번에 들어온다. 시맨틱 색의 옅은 배경 +
 * 진한 동일 계열 텍스트(스타일가이드 §4).
 *
 * **색만으로 상태를 전달하지 않는다**(스타일가이드 §8 인수 조건 · WCAG 1.4.1).
 * 라벨 텍스트가 children으로 반드시 들어오므로 색을 못 보는 사용자도 상태를 읽을 수 있고,
 * 아이콘을 붙이더라도 텍스트를 대체하지 않고 병행한다.
 */

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

type StatusBadgeProps = {
  tone?: StatusTone;
  /** 텍스트 앞에 놓을 아이콘. 장식이므로 `aria-hidden`으로 감싸 텍스트를 중복 낭독하지 않는다. */
  icon?: ReactNode;
  className?: string;
  /** 상태 라벨. 색을 못 보는 경로의 유일한 전달 수단이므로 생략할 수 없다. */
  children: ReactNode;
};

/** 스타일가이드 §3 — 칩/필 radius full. §1.2 시맨틱 색 + 옅은 배경. */
const BASE = "inline-flex items-center gap-1 rounded-full px-3 py-1 text-caption";

const TONES: Record<StatusTone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  error: "bg-error/10 text-error",
  info: "bg-info/10 text-info",
  neutral: "bg-border/60 text-text-muted",
};

export function StatusBadge({ tone = "neutral", icon, className, children }: StatusBadgeProps) {
  return (
    <span className={`${BASE} ${TONES[tone]} ${className ?? ""}`}>
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}
