import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";

import { BuilderCanvas } from "../features/builder/BuilderCanvas";
import { FixturePanel } from "../features/builder/FixturePanel";
import { ReservationForm } from "../features/builder/ReservationForm";
import { SelectionToolbar } from "../features/builder/SelectionToolbar";
import { toFixtureCatalog, useFixtures, useSpaceDetail } from "../features/builder/queries";
import { useCreateReservation } from "../features/builder/useCreateReservation";
import { useRotationShortcut } from "../features/builder/useRotationShortcut";
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

  const [rejection, setRejection] = useState<string | null>(null);
  const onRejected = useCallback((message: string) => setRejection(message), []);

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

  // 같은 그리드로 다시 불러도 배치는 유지된다(스토어가 멱등).
  useEffect(() => {
    if (grid) {
      initGrid(grid);
    }
  }, [grid, initGrid]);

  useRotationShortcut(catalog, onRejected);

  // 거부 안내는 잠깐만 띄운다.
  useEffect(() => {
    if (!rejection) {
      return;
    }

    const timer = setTimeout(() => setRejection(null), 2500);
    return () => clearTimeout(timer);
  }, [rejection]);

  if (spaceQuery.isPending) {
    return <StatusMessage>도면 정보를 불러오는 중…</StatusMessage>;
  }

  if (spaceQuery.isError || !space || !grid) {
    return <StatusMessage tone="error">도면 정보를 불러오지 못했습니다.</StatusMessage>;
  }

  return (
    <main className="flex flex-col gap-4 px-6 py-6">
      <header>
        <h1 className="text-display">{space.name}</h1>
        <p className="mt-2 text-caption text-text-muted">
          {space.address} · 그리드 {grid.gridCols}×{grid.gridRows}칸 (한 칸 {grid.cellSizeMm}mm) ·
          허용 전력 {space.maxPowerWatt.toLocaleString("ko-KR")}W
        </p>
      </header>

      <div className="flex items-center gap-4">
        <SelectionToolbar fixtures={catalog} onRejected={onRejected} />
        {rejection ? (
          <p role="alert" className="text-caption text-error">
            {rejection}
          </p>
        ) : null}
      </div>

      <div className="flex gap-6">
        <FixturePanel fixtures={fixturesQuery.data ?? []} isLoading={fixturesQuery.isPending} />
        <div className="overflow-auto">
          <BuilderCanvas grid={grid} fixtures={catalog} onRejected={onRejected} />
        </div>
        <div className="w-80 shrink-0">
          <ReservationForm
            space={space}
            fixtures={catalog}
            onSubmit={reservation.submit}
            isPending={reservation.isPending}
            errorMessage={reservation.errorMessage}
          />
        </div>
      </div>
    </main>
  );
}

function StatusMessage({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <main className="px-6 py-6">
      <p className={`text-body ${tone === "error" ? "text-error" : "text-text-muted"}`}>
        {children}
      </p>
    </main>
  );
}
