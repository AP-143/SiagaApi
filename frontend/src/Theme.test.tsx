import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "./App";
import { createdMaps, openPopups } from "./test/fakeMapLibre";
import { SAMBAS_HOTSPOT, collection } from "./test/hotspotFixtures";
import { mockApi } from "./test/mockApi";

vi.mock("maplibre-gl", async () => (await import("./test/fakeMapLibre")).fakeMapLibreModule);

function systemPrefersDark(dark: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-color-scheme: dark") ? dark : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

function setup() {
  window.history.replaceState({}, "", "/");
  mockApi({ "/hotspots": collection(SAMBAS_HOTSPOT), "/hotspots/counts": [], "/provinces": [] });
  render(<App />);
}

const theme = () => document.documentElement.dataset.theme;

beforeEach(() => {
  createdMaps.length = 0;
  openPopups.length = 0;
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

test("the page introduces itself", () => {
  systemPrefersDark(false);
  setup();

  expect(screen.getByRole("heading", { level: 1, name: "SiagaApi" })).toBeInTheDocument();
  expect(screen.getByText("Pantau titik api Kalimantan")).toBeInTheDocument();
});

test("the map is dark, whatever the system prefers", () => {
  systemPrefersDark(false);
  setup();

  expect(theme()).toBe("dark");
});

test("a light choice remembered from an earlier visit is ignored", () => {
  localStorage.setItem("siagaapi-theme", "light");
  systemPrefersDark(false);
  setup();

  expect(theme()).toBe("dark");
});

test("there is no theme switch", () => {
  systemPrefersDark(false);
  setup();

  expect(screen.queryByRole("button", { name: /tema/i })).toBeNull();
});

test("the basemap is the dark one so Hotspots stand out", async () => {
  systemPrefersDark(false);
  setup();
  await waitFor(() => expect(createdMaps).toHaveLength(1));
  const map = createdMaps[0];

  const min = map.basemapPaint("osm", "raster-brightness-min") as number;
  const max = map.basemapPaint("osm", "raster-brightness-max") as number;
  // The dark basemap is inverted: light areas become dark.
  expect(min).toBeGreaterThan(max);
});
