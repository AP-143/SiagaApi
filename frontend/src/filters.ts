export type TimeWindow = "24h" | "48h" | "7d";

export const TIME_WINDOWS: Array<{ value: TimeWindow; label: string }> = [
  { value: "24h", label: "24 jam" },
  { value: "48h", label: "48 jam" },
  { value: "7d", label: "7 hari" },
];

export type Filters = {
  province: string | null;
  regency: string | null;
  window: TimeWindow;
  showLowConfidence: boolean;
  peatOnly: boolean;
};

export const DEFAULT_FILTERS: Filters = {
  province: null,
  regency: null,
  window: "24h",
  showLowConfidence: false,
  peatOnly: false,
};

/** Read filters from a page address; anything unusable falls back to the default. */
export function parseFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const window = params.get("window");
  const province = params.get("province") || null;
  return {
    province,
    // A Regency only means something inside its Province
    regency: province ? params.get("regency") || null : null,
    window: TIME_WINDOWS.some((w) => w.value === window) ? (window as TimeWindow) : "24h",
    showLowConfidence: params.get("low") === "1",
    peatOnly: params.get("peat") === "1",
  };
}

/** The page-address query for these filters; defaults are left out to keep addresses short. */
export function filtersToSearch(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.province) params.set("province", filters.province);
  if (filters.province && filters.regency) params.set("regency", filters.regency);
  if (filters.window !== DEFAULT_FILTERS.window) params.set("window", filters.window);
  if (filters.showLowConfidence) params.set("low", "1");
  if (filters.peatOnly) params.set("peat", "1");
  const query = params.toString();
  return query ? `?${query}` : "";
}
