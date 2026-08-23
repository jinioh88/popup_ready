import { Link } from "react-router";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { SpaceSummary } from "../../lib/schemas/api";

/**
 * 우측 상가 요약 카드 (US-101 인수 조건).
 * '선택 완료'를 누르면 도면 빌더 단계로 넘어간다.
 */
export function SpaceSummaryPanel({ space }: { space: SpaceSummary | null }) {
  if (!space) {
    return (
      <aside className="w-80 shrink-0">
        <Card as="p" className="text-caption text-text-muted">
          공실을 선택하면 요약 정보가 표시됩니다.
        </Card>
      </aside>
    );
  }

  return (
    <aside className="w-80 shrink-0">
      <Card className="flex flex-col gap-4">
        <div>
          <h2 className="text-heading">{space.name}</h2>
          <p className="mt-1 text-caption text-text-muted">{space.address}</p>
        </div>

        <dl className="flex flex-col gap-1 text-caption">
          <Row label="일일 대여료" value={`${space.dailyRent.toLocaleString("ko-KR")}원`} />
          <Row label="실면적" value={`${space.floorAreaM2}㎡`} />
          <Row label="허용 전력" value={`${space.maxPowerWatt.toLocaleString("ko-KR")}W`} />
        </dl>

        {/* 버튼처럼 보이는 링크 — 색·높이의 두 번째 원천이 되지 않도록 Button 규격을 그대로 쓴다. */}
        <Button as={Link} to={`/spaces/${space.id}/builder`}>
          선택 완료
        </Button>
      </Card>
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
