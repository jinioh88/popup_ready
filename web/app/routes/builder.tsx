import { useEffect, useMemo } from "react";
import { useParams } from "react-router";

import { BuilderCanvas } from "../features/builder/BuilderCanvas";
import { CanvasController } from "../features/builder/CanvasController";
import { FixturePanel } from "../features/builder/FixturePanel";
import { LimitGauge } from "../features/builder/LimitGauge";
import { ReservationForm } from "../features/builder/ReservationForm";
import { toFixtureCatalog, useFixtures, useSpaceDetail } from "../features/builder/queries";
import { useCreateReservation } from "../features/builder/useCreateReservation";
import { useKeyboardPlacement } from "../features/builder/useKeyboardPlacement";
import { useLoadSummary } from "../features/builder/useLoadSummary";
import { useRotationShortcut } from "../features/builder/useRotationShortcut";
import { useTransientMessage } from "../features/builder/useTransientMessage";
import { useBuilderStore } from "../stores/builder";

export function meta() {
  return [{ title: "매장 배치 · PopupReady" }];
}

/** US-102 2D 가상 매장 빌더. 이 모듈은 화면 조립만 한다 — 계산은 app/lib, 상태는 app/stores. */
export default function BuilderRoute() {
  const { spaceId } = useParams();
  const numericSpaceId = Number(spaceId);

  const spaceQuery = useSpaceDetail(numericSpaceId);
  const fixturesQuery = useFixtures();
  const initGrid = useBuilderStore((state) => state.initGrid);

  const { message: rejection, show: onRejected } = useTransientMessage();

  const catalog = useMemo(() => toFixtureCatalog(fixturesQuery.data), [fixturesQuery.data]);
  const space = spaceQuery.data;
  const reservation = useCreateReservation(numericSpaceId);

  const grid = useMemo(
    () =>
      space
        ? {
            gridCols: space.gridCols,
            gridRows: space.gridRows,
            cellSizeMm: space.cellSizeMm,
          }
        : null,
    [space],
  );

  // 같은 상가·같은 그리드로 다시 불러도 배치는 유지되고, 상가가 바뀌면 비워진다.
  useEffect(() => {
    if (grid) {
      initGrid(numericSpaceId, grid);
    }
  }, [numericSpaceId, grid, initGrid]);

  // 훅은 조기 return 위에 모아 둔다. 도면을 못 불러온 동안에는 빈 그리드로 합산되고,
  // 그 결과는 아래 로딩·오류 분기에서 렌더되지 않는다.
  const items = useBuilderStore((state) => state.items);
  const load = useLoadSummary({
    items,
    fixtures: catalog,
    grid: grid ?? EMPTY_GRID,
    maxPowerWatt: space?.maxPowerWatt ?? 0,
  });

  useRotationShortcut(catalog, onRejected);
  useKeyboardPlacement(catalog, onRejected);

  if (spaceQuery.isPending) {
    return <StatusMessage>도면 정보를 불러오는 중…</StatusMessage>;
  }

  if (spaceQuery.isError || !space || !grid) {
    return <StatusMessage tone="error">도면 정보를 불러오지 못했습니다.</StatusMessage>;
  }

  // 서버는 INACTIVE 공간의 예약을 400으로 물린다(sprint1.md §2.2, 2026-08-23).
  // 배치를 다 끝낸 뒤 제출 시점에 거절당하지 않도록 진입 자체를 막는다.
  if (space.status !== "ACTIVE") {
    return (
      <StatusMessage tone="error">
        현재 예약을 받지 않는 상가입니다. 다른 상가를 선택해 주세요.
      </StatusMessage>
    );
  }

  return (
    <main className="flex flex-col gap-4 px-6 py-6">
      <header>
        <h1 className="text-display">{space.name}</h1>
        <p className="mt-2 text-caption text-text-muted tabular-nums">
          {space.address} · 그리드 {grid.gridCols}×{grid.gridRows}칸 (한 칸 {grid.cellSizeMm}mm) ·
          허용 전력 {space.maxPowerWatt.toLocaleString("ko-KR")}W
        </p>
      </header>

      {/* 도면 상단 고정 — 배치를 바꾸면 여기가 먼저 반응한다 (US-103). */}
      <LimitGauge load={load} />

      <CanvasController fixtures={catalog} onRejected={onRejected} rejection={rejection} />

      <div className="flex gap-6">
        <FixturePanel fixtures={fixturesQuery.data ?? []} isLoading={fixturesQuery.isPending} />
        <div className="overflow-auto">
          <BuilderCanvas grid={grid} fixtures={catalog} onRejected={onRejected} />
        </div>
        {/* 날짜 두 칸이 나란히 들어가야 한다 — w-80이면 date 입력 고유 폭에 눌려 좁아진다. */}
        <div className="w-96 shrink-0">
          <ReservationForm
            space={space}
            fixtures={catalog}
            onSubmit={reservation.submit}
            isPending={reservation.isPending}
            errorMessage={reservation.errorMessage}
            isOverPowerLimit={load.blocksSubmit}
          />
        </div>
      </div>
    </main>
  );
}

/** 도면을 아직 못 불러온 동안 합산에 넘길 자리표시 그리드. */
const EMPTY_GRID = { gridCols: 0, gridRows: 0, cellSizeMm: 0 };

function StatusMessage({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <main className="px-6 py-6">
      <p className={`text-body ${tone === "error" ? "text-error" : "text-text-muted"}`}>
        {children}
      </p>
    </main>
  );
}
