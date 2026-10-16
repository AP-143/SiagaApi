import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "./App";
import { createdMaps, openPopups } from "./test/fakeMapLibre";
import {
  KALTIM_HOTSPOT,
  NO_REGENCY_HOTSPOT,
  SAMBAS_HOTSPOT,
  collection,
} from "./test/hotspotFixtures";
import { mockApi } from "./test/mockApi";
import { popupFields } from "./test/popup";

vi.mock("maplibre-gl", async () => (await import("./test/fakeMapLibre")).fakeMapLibreModule);

beforeEach(() => {
  createdMaps.length = 0;
  openPopups.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function contains(bounds: [[number, number], [number, number]], lon: number, lat: number) {
  const [[west, south], [east, north]] = bounds;
  return lon >= west && lon <= east && lat >= south && lat <= north;
}

test("the map opens framed on Kalimantan", () => {
  mockApi({ "/hotspots": collection() });
  render(<App />);

  const bounds = createdMaps[0]?.options.bounds;
  expect(bounds).toBeDefined();
  // Pontianak (west), Samarinda (east), Banjarmasin (south), Tarakan (north)
  expect(contains(bounds!, 109.34, -0.03)).toBe(true);
  expect(contains(bounds!, 117.15, -0.5)).toBe(true);
  expect(contains(bounds!, 114.59, -3.32)).toBe(true);
  expect(contains(bounds!, 117.58, 3.3)).toBe(true);
  // Jakarta is not Kalimantan
  expect(contains(bounds!, 106.85, -6.2)).toBe(false);
});

test("Hotspots from the API are drawn on the map", async () => {
  mockApi({ "/hotspots": collection(SAMBAS_HOTSPOT, KALTIM_HOTSPOT) });
  render(<App />);

  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(2));
  const coordinates = createdMaps[0]
    .hotspotData("hotspots")
    .map((feature) => (feature.geometry as GeoJSON.Point).coordinates);
  expect(coordinates).toEqual([
    [110.25, 0.25],
    [117.5, 0.5],
  ]);
});

test("tapping a Hotspot shows when, by which satellite, how sure, and where", async () => {
  mockApi({ "/hotspots": collection(SAMBAS_HOTSPOT) });
  render(<App />);
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));

  createdMaps[0].tap("hotspots", 1, [110.25, 0.25]);

  expect(openPopups).toHaveLength(1);
  const fields = popupFields(openPopups[0].content!);
  // 05:40 UTC is 12.40 in West Kalimantan (WIB, UTC+7)
  expect(fields["Waktu deteksi"]).toBe("16 Okt 2026, 12.40 WIB");
  expect(fields["Satelit"]).toBe("S-NPP");
  expect(fields["Kepercayaan"]).toBe("Tinggi");
  expect(fields["Kabupaten/Kota"]).toBe("Sambas");
  expect(fields["Provinsi"]).toBe("Kalimantan Barat");
});

test("a Hotspot in East Kalimantan is shown in WITA, not WIB", async () => {
  mockApi({ "/hotspots": collection(KALTIM_HOTSPOT) });
  render(<App />);
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));

  createdMaps[0].tap("hotspots", 2, [117.5, 0.5]);

  // 05:40 UTC is 13.40 in East Kalimantan (WITA, UTC+8)
  expect(popupFields(openPopups[0].content!)["Waktu deteksi"]).toBe("16 Okt 2026, 13.40 WITA");
});

test("a Hotspot outside every Regency says its Regency is unknown", async () => {
  mockApi({ "/hotspots": collection(NO_REGENCY_HOTSPOT) });
  render(<App />);
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));

  createdMaps[0].tap("hotspots", 3, [110.75, 0.25]);

  expect(popupFields(openPopups[0].content!)["Kabupaten/Kota"]).toBe("Tidak diketahui");
});

test("the map still opens when the API is unreachable", async () => {
  mockApi({ "/hotspots": () => new Response("down", { status: 503 }) });

  render(<App />);

  await waitFor(() => expect(createdMaps).toHaveLength(1));
  expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(0);
});
