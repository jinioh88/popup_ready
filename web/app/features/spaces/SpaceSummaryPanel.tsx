import { Link } from "react-router";

import type { SpaceSummary } from "../../lib/schemas/api";

/**
 * 우측 상가 요약 카드 (US-101 인수 조건).
 * '선택 완료'를 누르면 도면 빌더 단계로 넘어간다.
 */
export function SpaceSummaryPanel({ space }: { space: SpaceSummary | null }) {
  if (!space) {
    return (
      <aside className="w-80 shrink-0">
        <p className="rounded-xl border border-border bg-surface p-4 text-caption text-text-muted">
          공실을 선택하면 요약 정보가 표시됩니다.
        </p>
      </aside>
    );
  }

  return (
    <aside className="w-80 shrink-0">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
        <div>
          <h2 className="text-heading">{space.name}</h2>
          <p className="mt-1 text-caption text-text-muted">{space.address}</p>
        </div>

        <dl className="flex flex-col gap-1 text-caption">
          <Row label="일일 대여료" value={`${space.dailyRent.toLocaleString("ko-KR")}원`} />
          <Row label="실면적" value={`${space.floorAreaM2}㎡`} />
          <Row label="허용 전력" value={`${space.maxPowerWatt.toLocaleString("ko-KR")}W`} />
        </dl>

        <Link
          to={`/spaces/${space.id}/builder`}
          className="flex h-10 items-center justify-center rounded-lg bg-primary text-body-strong text-white hover:bg-primary-dark"
        >
          선택 완료
        </Link>
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
