import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

test("the theme follows the system when nothing was chosen", () => {
  systemPrefersDark(true);
  setup();
  expect(theme()).toBe("dark");
});

test("a light system gets the light theme", () => {
  systemPrefersDark(false);
  setup();
  expect(theme()).toBe("light");
});

test("the theme can be switched, and the button says what it will do", async () => {
  systemPrefersDark(false);
  setup();

  await userEvent.click(screen.getByRole("button", { name: "Ganti ke tema gelap" }));

  expect(theme()).toBe("dark");
  expect(screen.getByRole("button", { name: "Ganti ke tema terang" })).toBeInTheDocument();
});

test("the chosen theme is remembered for the next visit", async () => {
  systemPrefersDark(false);
  setup();
  await userEvent.click(screen.getByRole("button", { name: "Ganti ke tema gelap" }));

  document.body.innerHTML = "";
  delete document.documentElement.dataset.theme;
  setup();

  expect(theme()).toBe("dark");
});

test("a remembered choice wins over the system setting", () => {
  localStorage.setItem("siagaapi-theme", "light");
  systemPrefersDark(true);

  setup();

  expect(theme()).toBe("light");
});

test("the page still works when the browser refuses to store the choice", async () => {
  systemPrefersDark(false);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("storage blocked");
  });
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("storage blocked");
  });
  setup();

  await userEvent.click(screen.getByRole("button", { name: "Ganti ke tema gelap" }));

  expect(theme()).toBe("dark");
  vi.restoreAllMocks();
});

test("the basemap goes dark with the theme so Hotspots stand out", async () => {
  systemPrefersDark(false);
  setup();
  await waitFor(() => expect(createdMaps).toHaveLength(1));
  const map = createdMaps[0];
  const light = {
    min: map.basemapPaint("osm", "raster-brightness-min") as number,
    max: map.basemapPaint("osm", "raster-brightness-max") as number,
  };

  await userEvent.click(screen.getByRole("button", { name: "Ganti ke tema gelap" }));

  const dark = {
    min: map.basemapPaint("osm", "raster-brightness-min") as number,
    max: map.basemapPaint("osm", "raster-brightness-max") as number,
  };
  // A light basemap runs dark to bright; the dark one is inverted: light areas become dark.
  expect(light.min).toBeLessThan(light.max);
  expect(dark.min).toBeGreaterThan(dark.max);
});

test("the map is not rebuilt when the theme changes", async () => {
  systemPrefersDark(false);
  setup();
  await waitFor(() => expect(createdMaps).toHaveLength(1));

  await userEvent.click(screen.getByRole("button", { name: "Ganti ke tema gelap" }));

  expect(createdMaps).toHaveLength(1);
});
