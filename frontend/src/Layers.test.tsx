import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "./App";
import { createdMaps, openPopups } from "./test/fakeMapLibre";
import { SAMBAS_HOTSPOT, collection } from "./test/hotspotFixtures";
import { mockApi } from "./test/mockApi";

vi.mock("maplibre-gl", async () => (await import("./test/fakeMapLibre")).fakeMapLibreModule);

function polygon(west: number, south: number) {
  const east = west + 0.3;
  const north = south + 0.3;
  return {
    type: "Polygon" as const,
    coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
  };
}

function featureCollection(...features: unknown[]) {
  return { type: "FeatureCollection", features };
}

const PEAT_LAYER = featureCollection({ type: "Feature", properties: {}, geometry: polygon(112, -2) });
const PROVINCE_LAYER = featureCollection({
  type: "Feature",
  properties: { code: "ID62", name: "Kalimantan Tengah" },
  geometry: polygon(111, -3),
});
const REGENCY_LAYER = featureCollection(
  {
    type: "Feature",
    properties: { code: "ID6271", name: "Palangka Raya", province_code: "ID62" },
    geometry: polygon(112, -2),
  },
  {
    type: "Feature",
    properties: { code: "ID6208", name: "Seruyan", province_code: "ID62" },
    geometry: polygon(112.5, -2),
  },
);

function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

function setup(url = "/", routes: Record<string, unknown> = {}) {
  window.history.replaceState({}, "", url);
  const fetchMock = mockApi({
    "/hotspots": collection(SAMBAS_HOTSPOT),
    "/hotspots/counts": [],
    "/provinces": [],
    "/freshness": { last_updated: "2026-10-16T07:00:00Z", stale: false },
    "/layers/peatlands": PEAT_LAYER,
    "/layers/provinces": PROVINCE_LAYER,
    "/layers/regencies": REGENCY_LAYER,
    ...routes,
  });
  render(<App />);
  return fetchMock;
}

function layerRequests(fetchMock: ReturnType<typeof mockApi>, name: string) {
  return fetchMock.mock.calls.filter(
    ([url]) => new URL(String(url), "http://localhost").pathname === `/api/layers/${name}`,
  );
}

const map = () => createdMaps[0];

beforeEach(() => {
  createdMaps.length = 0;
  openPopups.length = 0;
  localStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-16T08:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

// ---- Province outlines and peatland shown by default; Regency lines on request ------------------

test("peatland and Province outlines are drawn by default", async () => {
  setup();

  await waitFor(() => expect(map().hotspotData("peatlands")).toHaveLength(1));
  await waitFor(() => expect(map().hotspotData("provinces")).toHaveLength(1));
  expect(map().layerVisibility("peat-fill")).toBe("visible");
  expect(map().layerVisibility("province-lines")).toBe("visible");
});

test("Regency lines are off by default and are not even downloaded until wanted", async () => {
  const fetchMock = setup();
  await waitFor(() => expect(map().hotspotData("peatlands")).toHaveLength(1));

  expect(map().layerVisibility("regency-lines")).toBe("none");
  expect(layerRequests(fetchMock, "regencies")).toHaveLength(0);
});

test("switching on Regency lines downloads and shows them", async () => {
  const fetchMock = setup();
  await waitFor(() => expect(map().hotspotData("peatlands")).toHaveLength(1));

  await userEvent.click(screen.getByLabelText("Batas kabupaten/kota"));

  await waitFor(() => expect(map().hotspotData("regencies")).toHaveLength(2));
  expect(map().layerVisibility("regency-lines")).toBe("visible");
  expect(layerRequests(fetchMock, "regencies")).toHaveLength(1);
});

test("switching a layer off and on again does not download it twice", async () => {
  const fetchMock = setup();
  await waitFor(() => expect(map().hotspotData("peatlands")).toHaveLength(1));

  await userEvent.click(screen.getByLabelText("Area lahan gambut"));
  expect(map().layerVisibility("peat-fill")).toBe("none");
  expect(map().layerVisibility("peat-outline")).toBe("none");
  await userEvent.click(screen.getByLabelText("Area lahan gambut"));

  expect(map().layerVisibility("peat-fill")).toBe("visible");
  expect(layerRequests(fetchMock, "peatlands")).toHaveLength(1);
});

test("Hotspots are always drawn above the boundary and peatland layers", async () => {
  setup();
  await waitFor(() => expect(map().layerIds()).toContain("hotspots"));

  const order = map().layerIds();
  for (const below of ["peat-fill", "peat-outline", "regency-lines", "province-lines"]) {
    expect(order.indexOf(below)).toBeGreaterThanOrEqual(0);
    expect(order.indexOf(below)).toBeLessThan(order.indexOf("hotspots-glow"));
  }
  expect(order.indexOf("hotspots-glow")).toBeLessThan(order.indexOf("hotspots"));
});

// ---- When a layer cannot be loaded ---------------------------------------------------------------

test("a layer that fails to load is reported, and the Hotspots still work", async () => {
  setup("/", { "/layers/peatlands": () => new Response("down", { status: 503 }) });

  expect(await screen.findByText("Lapisan area lahan gambut gagal dimuat")).toBeInTheDocument();
  await waitFor(() => expect(map().hotspotData("hotspots")).toHaveLength(1));
  expect(map().hotspotData("provinces")).toHaveLength(1);
});

test("switching a failed layer off and on retries it", async () => {
  let calls = 0;
  const fetchMock = setup("/", {
    "/layers/peatlands": () => (++calls === 1 ? new Response("down", { status: 503 }) : json(PEAT_LAYER)),
  });
  await screen.findByText("Lapisan area lahan gambut gagal dimuat");

  await userEvent.click(screen.getByLabelText("Area lahan gambut"));
  await userEvent.click(screen.getByLabelText("Area lahan gambut"));

  await waitFor(() => expect(map().hotspotData("peatlands")).toHaveLength(1));
  expect(screen.queryByText("Lapisan area lahan gambut gagal dimuat")).toBeNull();
  expect(layerRequests(fetchMock, "peatlands")).toHaveLength(2);
});

// ---- Shareable address ---------------------------------------------------------------------------

test("the default layers leave the page address untouched", async () => {
  setup();
  await waitFor(() => expect(map().hotspotData("peatlands")).toHaveLength(1));

  expect(new URLSearchParams(window.location.search).has("layers")).toBe(false);
  expect(new URLSearchParams(window.location.search).has("base")).toBe(false);
});

test("the chosen layers are reflected in the page address", async () => {
  setup();
  await userEvent.click(screen.getByLabelText("Batas kabupaten/kota"));

  expect(new URLSearchParams(window.location.search).get("layers")).toBe("provinsi,kabupaten,gambut");
});

test("opening a shared address restores the same layers", async () => {
  const fetchMock = setup("/?layers=gambut");

  await waitFor(() => expect(map().hotspotData("peatlands")).toHaveLength(1));
  expect(layerRequests(fetchMock, "provinces")).toHaveLength(0);
  expect(map().layerVisibility("province-lines")).toBe("none");
  expect(screen.getByLabelText("Area lahan gambut")).toBeChecked();
  expect(screen.getByLabelText("Batas provinsi")).not.toBeChecked();
});

test("a shared address can switch every layer off", async () => {
  const fetchMock = setup("/?layers=none");
  await waitFor(() => expect(map()).toBeDefined());

  expect(["peatlands", "provinces", "regencies"].flatMap((n) => layerRequests(fetchMock, n))).toHaveLength(0);
  expect(screen.getByLabelText("Area lahan gambut")).not.toBeChecked();
});

test("a garbled layers parameter falls back to the defaults", async () => {
  setup("/?layers=foo,bar");

  expect(screen.getByLabelText("Area lahan gambut")).toBeChecked();
  expect(screen.getByLabelText("Batas provinsi")).toBeChecked();
  expect(screen.getByLabelText("Batas kabupaten/kota")).not.toBeChecked();
});

// ---- Satellite imagery ---------------------------------------------------------------------------

test("the street map is the default base map", async () => {
  setup();
  await waitFor(() => expect(map()).toBeDefined());

  expect(screen.getByRole("radio", { name: "Peta" })).toBeChecked();
  expect(map().layerVisibility("osm")).toBe("visible");
  expect(map().layerVisibility("satellite")).toBe("none");
});

test("choosing Satelit swaps the base map for satellite imagery", async () => {
  setup();
  await waitFor(() => expect(map()).toBeDefined());

  await userEvent.click(screen.getByRole("radio", { name: "Satelit" }));

  expect(map().layerVisibility("satellite")).toBe("visible");
  expect(map().layerVisibility("osm")).toBe("none");
});

test("the satellite imagery is yesterday's NASA GIBS true-color mosaic, and the page says so", async () => {
  setup();
  await waitFor(() => expect(map()).toBeDefined());

  await userEvent.click(screen.getByRole("radio", { name: "Satelit" }));

  const [tileUrl] = map().styleSource("satellite")!.tiles as string[];
  expect(tileUrl).toContain("gibs.earthdata.nasa.gov");
  expect(tileUrl).toContain("VIIRS_SNPP_CorrectedReflectance_TrueColor");
  expect(tileUrl).toContain("/2026-10-15/"); // the system clock says 16 Oct, so the latest full day is 15 Oct
  expect(screen.getByText(/Citra satelit harian NASA GIBS, 15 Okt 2026/)).toBeInTheDocument();
});

test("the satellite caption is only shown while satellite imagery is in use", async () => {
  setup();
  await waitFor(() => expect(map()).toBeDefined());

  expect(screen.queryByText(/Citra satelit harian/)).toBeNull();
});

test("the base map choice is reflected in the page address and restored from it", async () => {
  setup("/?base=satellite");
  await waitFor(() => expect(map()).toBeDefined());

  expect(screen.getByRole("radio", { name: "Satelit" })).toBeChecked();
  expect(map().layerVisibility("satellite")).toBe("visible");

  await userEvent.click(screen.getByRole("radio", { name: "Peta" }));
  expect(new URLSearchParams(window.location.search).has("base")).toBe(false);
});

test("the map is not rebuilt when the base map or layers change", async () => {
  setup();
  await waitFor(() => expect(map()).toBeDefined());

  await userEvent.click(screen.getByRole("radio", { name: "Satelit" }));
  await userEvent.click(screen.getByLabelText("Batas kabupaten/kota"));

  expect(createdMaps).toHaveLength(1);
});

// ---- Boundary lines stay readable on every background -------------------------------------------

function lineColor() {
  return map().paintValue("province-lines", "line-color") as string;
}

function isLight(hex: string) {
  const value = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

test("boundary lines are dark on the light street map", async () => {
  localStorage.setItem("siagaapi-theme", "light");
  setup();
  await waitFor(() => expect(map()).toBeDefined());

  expect(isLight(lineColor())).toBe(false);
});

test("boundary lines turn light on satellite imagery so they can be seen", async () => {
  localStorage.setItem("siagaapi-theme", "light");
  setup();
  await waitFor(() => expect(map()).toBeDefined());

  await userEvent.click(screen.getByRole("radio", { name: "Satelit" }));

  expect(isLight(lineColor())).toBe(true);
});

test("boundary lines are light on the dark theme", async () => {
  localStorage.setItem("siagaapi-theme", "dark");
  setup();
  await waitFor(() => expect(map()).toBeDefined());

  expect(isLight(lineColor())).toBe(true);
});

// ---- Legend and credits --------------------------------------------------------------------------

test("the legend explains each layer that is switched on", async () => {
  setup();
  const legend = await screen.findByRole("region", { name: "Keterangan" });

  expect(within(legend).getByText(/Area ungu transparan/)).toBeInTheDocument();
  expect(within(legend).getByText(/Garis tebal: batas provinsi/)).toBeInTheDocument();
  expect(within(legend).queryByText(/Garis tipis: batas kabupaten/)).toBeNull();
});

test("the legend drops the explanation of a layer that is switched off", async () => {
  setup();
  await screen.findByRole("region", { name: "Keterangan" });

  await userEvent.click(screen.getByLabelText("Area lahan gambut"));
  await userEvent.click(screen.getByLabelText("Batas kabupaten/kota"));

  const legend = screen.getByRole("region", { name: "Keterangan" });
  expect(within(legend).queryByText(/Area ungu transparan/)).toBeNull();
  expect(within(legend).getByText(/Garis tipis: batas kabupaten/)).toBeInTheDocument();
});

test("NASA GIBS is credited for the satellite imagery", async () => {
  setup();

  expect(await screen.findByText(/NASA FIRMS/)).toHaveTextContent("NASA EOSDIS GIBS");
});

// ---- The imagery date is part of the page, not of one panel ------------------------------------

test("the date of the satellite imagery is visible even when every panel is closed", async () => {
  // On a phone every panel starts closed, and the address can bring satellite imagery back.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: true,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  setup("/?base=satellite");
  await waitFor(() => expect(map()).toBeDefined());

  expect(screen.getByRole("button", { name: "Lapisan" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByText(/Citra satelit: 15 Okt 2026/)).toBeInTheDocument();
});

test("the imagery date appears when satellite is chosen and goes when the map is chosen again", async () => {
  setup();
  await waitFor(() => expect(map()).toBeDefined());
  expect(screen.queryByText(/Citra satelit: \d+ [A-Za-z]+ \d{4}/)).toBeNull();

  await userEvent.click(screen.getByRole("radio", { name: "Satelit" }));
  expect(screen.getByText(/Citra satelit: 15 Okt 2026/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("radio", { name: "Peta" }));
  expect(screen.queryByText(/Citra satelit: \d+ [A-Za-z]+ \d{4}/)).toBeNull();
});
