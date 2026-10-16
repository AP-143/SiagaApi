import type { Area } from "./api";
import Collapsible from "./Collapsible";
import { type Filters, TIME_WINDOWS, type TimeWindow } from "./filters";
import { FilterIcon } from "./icons";
import Switch from "./Switch";

type Props = {
  filters: Filters;
  provinces: Area[];
  regencies: Area[];
  onChange: (filters: Filters) => void;
  /** Only used to explain the layers that are switched on. */
  open: boolean;
  onToggle: () => void;
};

export default function FilterPanel({
  filters,
  provinces,
  regencies,
  onChange,
  open,
  onToggle,
}: Props) {
  return (
    <section className="card filter-panel">
      <Collapsible label="Filter" icon={<FilterIcon />} open={open} onToggle={onToggle}>
        <form onSubmit={(event) => event.preventDefault()}>
          <label className="field">
            <span className="field-label">Provinsi</span>
            <select
              value={filters.province ?? ""}
              onChange={(event) =>
                // A Regency belongs to one Province, so changing Province clears it.
                onChange({ ...filters, province: event.target.value || null, regency: null })
              }
            >
              <option value="">Semua provinsi</option>
              {provinces.map((province) => (
                <option key={province.code} value={province.code}>
                  {province.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Kabupaten/Kota</span>
            <select
              value={filters.regency ?? ""}
              disabled={!filters.province}
              onChange={(event) => onChange({ ...filters, regency: event.target.value || null })}
            >
              <option value="">Semua kabupaten/kota</option>
              {regencies.map((regency) => (
                <option key={regency.code} value={regency.code}>
                  {regency.name}
                </option>
              ))}
            </select>
          </label>

          <div className="field">
            <span className="field-label" id="window-label">
              Rentang waktu
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="window-label">
              {TIME_WINDOWS.map((window) => (
                <label key={window.value} className="segment">
                  <input
                    type="radio"
                    name="window"
                    value={window.value}
                    checked={filters.window === window.value}
                    onChange={() => onChange({ ...filters, window: window.value as TimeWindow })}
                  />
                  <span>{window.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Switch
            label="Tampilkan kepercayaan rendah"
            checked={filters.showLowConfidence}
            onChange={(showLowConfidence) => onChange({ ...filters, showLowConfidence })}
          />
          <Switch
            label="Hanya titik api di lahan gambut"
            checked={filters.peatOnly}
            onChange={(peatOnly) => onChange({ ...filters, peatOnly })}
          />
        </form>
      </Collapsible>
    </section>
  );
}
