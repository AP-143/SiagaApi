import type { Theme } from "../theme";
import type { Basemap, LayerName } from "../view";

/** Map layer ids, listed bottom to top. Hotspots are added after these, so they stay on top. */
export const OVERLAY_LAYERS: Array<{ id: string; layer: LayerName }> = [
  { id: "peat-fill", layer: "peatlands" },
  { id: "peat-outline", layer: "peatlands" },
  { id: "regency-lines", layer: "regencies" },
  { id: "province-lines", layer: "provinces" },
];

const PEAT = "#a855f7";

/**
 * Boundary lines need to contrast with whatever is under them: pale on the dark map or satellite
 * imagery, dark on the light street map.
 */
export function boundaryLineColor(theme: Theme, basemap: Basemap): string {
  return theme === "dark" || basemap === "satellite" ? "#f8fafc" : "#334155";
}

export function overlayLayerSpecs(theme: Theme, basemap: Basemap) {
  const lines = boundaryLineColor(theme, basemap);
  return [
    {
      id: "peat-fill",
      type: "fill" as const,
      source: "peatlands",
      paint: { "fill-color": PEAT, "fill-opacity": 0.22 },
    },
    {
      id: "peat-outline",
      type: "line" as const,
      source: "peatlands",
      paint: { "line-color": PEAT, "line-opacity": 0.6, "line-width": 1 },
    },
    {
      id: "regency-lines",
      type: "line" as const,
      source: "regencies",
      paint: { "line-color": lines, "line-opacity": 0.7, "line-width": 0.9, "line-dasharray": [3, 2] },
    },
    {
      id: "province-lines",
      type: "line" as const,
      source: "provinces",
      paint: { "line-color": lines, "line-opacity": 0.9, "line-width": 2 },
    },
  ];
}
