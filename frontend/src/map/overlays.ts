import type { LayerName } from "../view";

/** Map layer ids, listed bottom to top. Hotspots are added after these, so they stay on top. */
export const OVERLAY_LAYERS: Array<{ id: string; layer: LayerName }> = [
  { id: "peat-fill", layer: "peatlands" },
  { id: "peat-outline", layer: "peatlands" },
  { id: "regency-casing", layer: "regencies" },
  { id: "regency-lines", layer: "regencies" },
  { id: "province-casing", layer: "provinces" },
  { id: "province-lines", layer: "provinces" },
];

const PEAT = "#a855f7";

/** Boundary lines are pale, so they show on the dark map. */
export const BOUNDARY_LINE_COLOR = "#f8fafc";

/**
 * A dark casing under each line. Over bright satellite imagery (white clouds) a pale line alone
 * disappears; with a dark edge it shows on both the dark map and the clouds.
 */
const CASING_COLOR = "#120c0e";

export function overlayLayerSpecs() {
  const lines = BOUNDARY_LINE_COLOR;
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
      id: "regency-casing",
      type: "line" as const,
      source: "regencies",
      paint: { "line-color": CASING_COLOR, "line-opacity": 0.45, "line-width": 2.2 },
    },
    {
      id: "regency-lines",
      type: "line" as const,
      source: "regencies",
      paint: { "line-color": lines, "line-opacity": 0.7, "line-width": 0.9, "line-dasharray": [3, 2] },
    },
    {
      id: "province-casing",
      type: "line" as const,
      source: "provinces",
      paint: { "line-color": CASING_COLOR, "line-opacity": 0.6, "line-width": 4.2 },
    },
    {
      id: "province-lines",
      type: "line" as const,
      source: "provinces",
      paint: { "line-color": lines, "line-opacity": 0.9, "line-width": 2 },
    },
  ];
}
