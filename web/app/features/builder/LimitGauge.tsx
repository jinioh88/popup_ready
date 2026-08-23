import { useEffect, useRef, useState } from "react";

import { Card } from "../../components/ui/Card";
import { StatusBadge } from "../../components/ui/StatusBadge";
import type { LoadSummary } from "../../lib/builder/load";

/**
 * 도면 상단 고정 한도 게이지 (US-103, 스타일가이드 §8.A).
 *
 * **두 축을 같은 모양으로 그리지 않는다**(sprint2.md §2.2-F). 전력은 초과 시 제출이 잠기는
 * 게이트고, 면적은 잠기지 않는 밀도 표시다. 같은 프로그레스 바 두 개로 그리면 사용자가 면적도
 * 차단 조건으로 읽는다.
 *
 *   전력  굵은 막대 · `현재 / 한도` · success → warning(80%) → error(100%) · 초과 시 잠금 표시
 *   면적  가는 막대 · `점유율 %`    · neutral → warning(70%)               · **error·잠금 없음**
 *
 * 면적 쪽에 `error` 색이나 잠금 아이콘을 쓰지 않는 것은 규칙이다 — 이 화면에서 그 둘은 곧
 * "차단"을 뜻하게 돼 있다.
 *
 * 경고를 **색만으로 전달하지 않는다**(§8 인수 조건 · WCAG 1.4.1) — 아이콘과 수치 텍스트를
 * 항상 병행하고, 상태 라벨은 `StatusBadge`가 글자로 말한다.
 */

type LimitGaugeProps = {
  load: LoadSummary;
};

export function LimitGauge({ load }: LimitGaugeProps) {
  const { power, area } = load;
  const isOver = power.level === "over";

  /**
   * 초과로 **바뀌는 순간** 한 번만 펄스한다(§8.A · WCAG 2.3.1).
   *
   * key가 바뀌면 요소가 다시 마운트되면서 애니메이션이 처음부터 한 번 재생된다. 초과 상태가
   * 유지되는 동안에는 key가 그대로라 다시 재생되지 않는다 — 깜빡임이 아니라 1회 알림이다.
   */
  const [pulseKey, setPulseKey] = useState(0);
  const previousLevel = useRef(power.level);

  useEffect(() => {
    if (previousLevel.current !== "over" && power.level === "over") {
      setPulseKey((key) => key + 1);
    }

    previousLevel.current = power.level;
  }, [power.level]);

  return (
    <Card className="flex flex-col gap-4" aria-label="배치 한도">
      <div
        key={pulseKey}
        className={`flex flex-col gap-2 rounded-lg ${isOver ? "limit-pulse border border-error p-3" : ""}`}
      >
        <div className="flex items-center gap-2">
          <PowerIcon />
          <span className="text-body-strong">소비 전력</span>
          <PowerStatus level={power.level} />
          {/* 색을 못 보는 경로에서도 값이 그대로 읽힌다. */}
          <span className="ml-auto text-caption text-text-muted tabular-nums">
            {watt(power.watt)} / {watt(power.limit)} ({percent(power.ratio)})
          </span>
        </div>

        <Meter
          ratio={power.ratio}
          thickness="h-3"
          fill={POWER_FILLS[power.level]}
          label="소비 전력"
          valueText={`${watt(power.watt)} / 허용 ${watt(power.limit)}, ${percent(power.ratio)}`}
        />

        {isOver ? (
          <p role="alert" className="text-caption text-error">
            허용 전력을 {watt(power.watt - power.limit)} 초과했습니다. 집기를 빼야 예약을 요청할 수
            있습니다.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <AreaIcon />
          <span className="text-body-strong">도면 점유</span>
          {area.level === "crowded" ? (
            <StatusBadge tone="warning" icon={<WarningIcon />}>
              혼잡
            </StatusBadge>
          ) : null}
          {/*
            분모를 함께 쓰지 않는다 — `17.5㎡ / 25㎡`로 적으면 25㎡가 한도처럼 읽힌다.
            면적은 한도가 아니라 점유율이다(§2.2-F).
          */}
          <span className="ml-auto text-caption text-text-muted tabular-nums">
            {squareMeters(area.m2)} 사용 · 점유율 {percent(area.ratio)}
          </span>
        </div>

        <Meter
          ratio={area.ratio}
          thickness="h-1"
          fill={area.level === "crowded" ? "bg-warning" : "bg-text-muted"}
          label="도면 점유"
          // '한도'라는 말을 넣지 않는다 — 이 축에는 한도가 없다.
          valueText={`도면 점유율 ${percent(area.ratio)}`}
        />

        {area.level === "crowded" ? (
          <p className="text-caption text-text-muted">
            배치 밀도가 높습니다. 통로 확보를 확인하세요. 예약 요청은 그대로 진행할 수 있습니다.
          </p>
        ) : null}
      </div>

      {load.hasUnknownFixture ? (
        <p role="alert" className="text-caption text-error">
          규격을 확인할 수 없는 집기가 있어 합산에서 빠졌습니다. 표시된 값이 실제보다 작을 수
          있습니다.
        </p>
      ) : null}
    </Card>
  );
}

const POWER_FILLS = {
  safe: "bg-success",
  near: "bg-warning",
  over: "bg-error",
} as const;

function PowerStatus({ level }: { level: LoadSummary["power"]["level"] }) {
  if (level === "over") {
    return (
      <StatusBadge tone="error" icon={<LockIcon />}>
        한도 초과
      </StatusBadge>
    );
  }

  if (level === "near") {
    return (
      <StatusBadge tone="warning" icon={<WarningIcon />}>
        한도 임박
      </StatusBadge>
    );
  }

  return (
    <StatusBadge tone="success" icon={<CheckIcon />}>
      여유
    </StatusBadge>
  );
}

/** 막대 하나. 게이지의 시각 규격은 여기 한 곳에서만 정한다. */
function Meter({
  ratio,
  thickness,
  fill,
  label,
  valueText,
}: {
  ratio: number;
  thickness: string;
  fill: string;
  label: string;
  valueText: string;
}) {
  // 100%를 넘어도 막대는 넘치지 않는다 — 넘친 양은 수치 텍스트가 말한다.
  const width = Math.min(Math.max(ratio, 0), 1) * 100;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuetext={valueText}
      className={`w-full overflow-hidden rounded-full bg-border ${thickness}`}
    >
      <div className={`h-full rounded-full transition-[width] ${fill}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function watt(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")}W`;
}

function squareMeters(value: number): string {
  return `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}㎡`;
}

function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/* 아이콘은 장식이다 — 의미는 옆의 텍스트가 전달한다(§8 색 단독 금지의 짝). */
const ICON = "h-4 w-4 shrink-0";

function PowerIcon() {
  return (
    <svg className={ICON} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M9 1 3 9h4l-1 6 6-8H8l1-6Z" />
    </svg>
  );
}

function AreaIcon() {
  return (
    <svg
      className={ICON}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="12" height="12" rx="1" />
      <path d="M2 6h12M6 2v12" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 1.5 15 14H1L8 1.5Zm-.75 4.5v4h1.5V6h-1.5Zm0 5.25v1.5h1.5v-1.5h-1.5Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 1a3 3 0 0 0-3 3v2H4v8h8V6h-1V4a3 3 0 0 0-3-3Zm1.5 5h-3V4a1.5 1.5 0 0 1 3 0v2Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M6.2 12 2 7.8l1.4-1.4 2.8 2.8L12.6 3 14 4.4 6.2 12Z" />
    </svg>
  );
}
