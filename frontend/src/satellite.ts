import { MONTHS } from "./map/time";

const LAYER = "VIIRS_SNPP_CorrectedReflectance_TrueColor";

/**
 * The most recent complete day of imagery: yesterday, in UTC. Today's mosaic is still being built
 * and has holes, so asking for a fixed past day keeps the picture, and the date shown, honest.
 */
export function latestSatelliteDate(now: Date = new Date()): string {
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return yesterday.toISOString().slice(0, 10);
}

/** NASA GIBS true-color mosaic from the same VIIRS family that detects the Hotspots. */
export function satelliteTileUrl(date: string): string {
  return (
    `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${LAYER}/default/${date}` +
    "/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg"
  );
}

/** "2026-10-15" becomes "15 Okt 2026". */
export function formatSatelliteDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}
