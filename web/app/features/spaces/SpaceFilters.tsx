import { AREA_PRESETS, RADIUS_OPTIONS, type SpaceSearchState } from "./searchState";

/**
 * 지역·반경 + 면적/대여료/전력 필터. 값은 쿼리 파라미터로 그대로 넘어간다.
 *
 * 지도를 움직이면 중심이 어느 프리셋과도 일치하지 않는다. 그 상태를 나타낼 option이 없으면
 * `<select value="">`가 표현할 값을 못 찾아 **첫 항목(성수)이 선택된 것처럼 보인다** — 그러면
 * 사용자가 원래 지역으로 되돌리려고 성수를 다시 골라도 값이 안 바뀌어 change가 발생하지 않고,
 * 아무 일도 일어나지 않는다(2026-08-23 사용자 인수 테스트의 "필터 되돌림 미동작").
 * 그래서 프리셋 밖 상태를 담는 option을 명시적으로 둔다.
 */

/** 지도를 움직여 프리셋 밖으로 나간 상태를 담는 option 값. */
const CUSTOM_CENTER = "__custom__";

export function SpaceFilters({
  search,
  onChange,
}: {
  search: SpaceSearchState;
  onChange: (next: SpaceSearchState) => void;
}) {
  const activePreset = AREA_PRESETS.find(
    (preset) => preset.lat === search.lat && preset.lng === search.lng,
  );

  return (
    <section className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-surface p-4">
      <Field label="지역">
        <select
          className={selectClass}
          value={activePreset?.id ?? CUSTOM_CENTER}
          onChange={(event) => {
            const preset = AREA_PRESETS.find((candidate) => candidate.id === event.target.value);

            if (preset) {
              onChange({ ...search, lat: preset.lat, lng: preset.lng });
            }
          }}
        >
          {activePreset ? null : <option value={CUSTOM_CENTER}>지도에서 옮긴 위치</option>}
          {AREA_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label="반경">
        <select
          className={selectClass}
          value={search.radius}
          onChange={(event) => onChange({ ...search, radius: Number(event.target.value) })}
        >
          {RADIUS_OPTIONS.map((radius) => (
            <option key={radius} value={radius}>
              {radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}
            </option>
          ))}
        </select>
      </Field>

      <NumberField
        label="최소 면적(㎡)"
        value={search.minArea}
        onChange={(minArea) => onChange({ ...search, minArea })}
      />
      <NumberField
        label="일일 대여료 상한(원)"
        value={search.maxRent}
        onChange={(maxRent) => onChange({ ...search, maxRent })}
        step={10_000}
      />
      <NumberField
        label="최소 허용 전력(W)"
        value={search.minPower}
        onChange={(minPower) => onChange({ ...search, minPower })}
        step={500}
      />
    </section>
  );
}

const selectClass = "h-10 rounded-lg border border-border bg-surface px-3 text-body";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-caption text-text-muted">{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  step?: number;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min={0}
        step={step}
        value={value ?? ""}
        placeholder="제한 없음"
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === "" ? undefined : Number(raw));
        }}
        className="h-10 w-40 rounded-lg border border-border bg-surface px-3 text-body"
      />
    </Field>
  );
}
