import type { HotspotCollection } from "../api";

export const SAMBAS_HOTSPOT = {
  type: "Feature" as const,
  geometry: { type: "Point" as const, coordinates: [110.25, 0.25] as [number, number] },
  properties: {
    id: 1,
    acquired_at: "2026-10-16T05:40:00Z",
    satellite: "S-NPP",
    confidence: "high" as const,
    province: { code: "ID61", name: "Kalimantan Barat" },
    regency: { code: "ID6101", name: "Sambas" },
    peat_hotspot: false,
  },
};

export const KALTIM_HOTSPOT = {
  type: "Feature" as const,
  geometry: { type: "Point" as const, coordinates: [117.5, 0.5] as [number, number] },
  properties: {
    id: 2,
    acquired_at: "2026-10-16T05:40:00Z",
    satellite: "NOAA-20",
    confidence: "nominal" as const,
    province: { code: "ID64", name: "Kalimantan Timur" },
    regency: { code: "ID6403", name: "Kutai Kartanegara" },
    peat_hotspot: false,
  },
};

export const NO_REGENCY_HOTSPOT = {
  type: "Feature" as const,
  geometry: { type: "Point" as const, coordinates: [110.75, 0.25] as [number, number] },
  properties: {
    id: 3,
    acquired_at: "2026-10-16T05:40:00Z",
    satellite: "NOAA-21",
    confidence: "low" as const,
    province: { code: "ID61", name: "Kalimantan Barat" },
    regency: null,
    peat_hotspot: false,
  },
};

export function collection(...features: HotspotCollection["features"]): HotspotCollection {
  return { type: "FeatureCollection", features };
}

export const PEAT_HOTSPOT = {
  type: "Feature" as const,
  geometry: { type: "Point" as const, coordinates: [112.25, -1.75] as [number, number] },
  properties: {
    id: 4,
    acquired_at: "2026-10-16T05:40:00Z",
    satellite: "NOAA-20",
    confidence: "high" as const,
    province: { code: "ID62", name: "Kalimantan Tengah" },
    regency: { code: "ID6271", name: "Palangka Raya" },
    peat_hotspot: true,
  },
};
