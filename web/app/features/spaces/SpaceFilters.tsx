import { AREA_PRESETS, RADIUS_OPTIONS, type SpaceSearchState } from "./searchState";

/** 지역·반경 + 면적/대여료/전력 필터. 값은 쿼리 파라미터로 그대로 넘어간다. */
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
          value={activePreset?.id ?? ""}
          onChange={(event) => {
            const preset = AREA_PRESETS.find((candidate) => candidate.id === event.target.value);

            if (preset) {
              onChange({ ...search, lat: preset.lat, lng: preset.lng });
            }
          }}
        >
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
