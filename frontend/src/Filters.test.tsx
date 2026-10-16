import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "./App";
import { createdMaps, openPopups } from "./test/fakeMapLibre";
import { SAMBAS_HOTSPOT, collection } from "./test/hotspotFixtures";
import { mockApi } from "./test/mockApi";

vi.mock("maplibre-gl", async () => (await import("./test/fakeMapLibre")).fakeMapLibreModule);

const PROVINCES = [
  { code: "ID61", name: "Kalimantan Barat" },
  { code: "ID62", name: "Kalimantan Tengah" },
];

function setup(url = "/") {
  window.history.replaceState({}, "", url);
  const fetchMock = mockApi({
    "/hotspots": collection(SAMBAS_HOTSPOT),
    "/provinces": PROVINCES,
    "/provinces/ID61/regencies": [
      { code: "ID6171", name: "Pontianak" },
      { code: "ID6101", name: "Sambas" },
    ],
    "/provinces/ID62/regencies": [{ code: "ID6271", name: "Palangka Raya" }],
  });
  render(<App />);
  return fetchMock;
}

function hotspotRequests(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .map(([url]) => new URL(String(url), "http://localhost"))
    .filter((url) => url.pathname === "/api/hotspots");
}

function lastHotspotRequest(fetchMock: ReturnType<typeof mockApi>) {
  return hotspotRequests(fetchMock).at(-1)!;
}

beforeEach(() => {
  createdMaps.length = 0;
  openPopups.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

test("by default the last 24 hours are shown across all of Kalimantan", async () => {
  const fetchMock = setup();

  await waitFor(() => expect(hotspotRequests(fetchMock)).toHaveLength(1));
  const request = lastHotspotRequest(fetchMock);
  expect(request.searchParams.get("window")).toBe("24h");
  expect(request.searchParams.has("province")).toBe(false);
  expect(request.searchParams.has("regency")).toBe(false);
  expect(screen.getByRole("radiogroup", { name: "Rentang waktu" })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "24 jam" })).toBeChecked();
});

test("the Regency list is disabled until a Province is chosen", async () => {
  setup();

  expect(await screen.findByRole("option", { name: "Kalimantan Barat" })).toBeInTheDocument();
  expect(screen.getByLabelText("Kabupaten/Kota")).toBeDisabled();
});

test("choosing a Province narrows the map and lists only that Province's Regencies", async () => {
  const fetchMock = setup();
  await screen.findByRole("option", { name: "Kalimantan Barat" });

  await userEvent.selectOptions(screen.getByLabelText("Provinsi"), "Kalimantan Barat");

  await waitFor(() => expect(lastHotspotRequest(fetchMock).searchParams.get("province")).toBe("ID61"));
  const regencySelect = screen.getByLabelText("Kabupaten/Kota");
  expect(regencySelect).toBeEnabled();
  expect(await screen.findByRole("option", { name: "Sambas" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Pontianak" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Palangka Raya" })).toBeNull();
});

test("choosing a Regency narrows the map further", async () => {
  const fetchMock = setup();
  await screen.findByRole("option", { name: "Kalimantan Barat" });
  await userEvent.selectOptions(screen.getByLabelText("Provinsi"), "Kalimantan Barat");
  await screen.findByRole("option", { name: "Sambas" });

  await userEvent.selectOptions(screen.getByLabelText("Kabupaten/Kota"), "Sambas");

  await waitFor(() => {
    const request = lastHotspotRequest(fetchMock);
    expect(request.searchParams.get("province")).toBe("ID61");
    expect(request.searchParams.get("regency")).toBe("ID6101");
  });
});

test("switching Province clears the Regency so a stale one is never applied", async () => {
  const fetchMock = setup();
  await screen.findByRole("option", { name: "Kalimantan Barat" });
  await userEvent.selectOptions(screen.getByLabelText("Provinsi"), "Kalimantan Barat");
  await screen.findByRole("option", { name: "Sambas" });
  await userEvent.selectOptions(screen.getByLabelText("Kabupaten/Kota"), "Sambas");

  await userEvent.selectOptions(screen.getByLabelText("Provinsi"), "Kalimantan Tengah");

  await waitFor(() => {
    const request = lastHotspotRequest(fetchMock);
    expect(request.searchParams.get("province")).toBe("ID62");
    expect(request.searchParams.has("regency")).toBe(false);
  });
  expect(screen.getByLabelText("Kabupaten/Kota")).toHaveValue("");
});

test("the time window can be widened to 48 hours and 7 days", async () => {
  const fetchMock = setup();
  await waitFor(() => expect(hotspotRequests(fetchMock)).toHaveLength(1));

  await userEvent.click(screen.getByRole("radio", { name: "48 jam" }));
  await waitFor(() => expect(lastHotspotRequest(fetchMock).searchParams.get("window")).toBe("48h"));

  await userEvent.click(screen.getByRole("radio", { name: "7 hari" }));
  await waitFor(() => expect(lastHotspotRequest(fetchMock).searchParams.get("window")).toBe("7d"));
});

test("the chosen filters are reflected in the page address", async () => {
  setup();
  await screen.findByRole("option", { name: "Kalimantan Barat" });

  await userEvent.selectOptions(screen.getByLabelText("Provinsi"), "Kalimantan Barat");
  await userEvent.click(screen.getByRole("radio", { name: "48 jam" }));

  const params = new URLSearchParams(window.location.search);
  expect(params.get("province")).toBe("ID61");
  expect(params.get("window")).toBe("48h");
});

test("opening a shared address restores the same view", async () => {
  const fetchMock = setup("/?province=ID61&regency=ID6101&window=7d");

  await waitFor(() => {
    const request = lastHotspotRequest(fetchMock);
    expect(request.searchParams.get("province")).toBe("ID61");
    expect(request.searchParams.get("regency")).toBe("ID6101");
    expect(request.searchParams.get("window")).toBe("7d");
  });
  await waitFor(() => expect(screen.getByLabelText("Provinsi")).toHaveValue("ID61"));
  await waitFor(() => expect(screen.getByLabelText("Kabupaten/Kota")).toHaveValue("ID6101"));
  expect(screen.getByRole("radio", { name: "7 hari" })).toBeChecked();
});

test("a garbled address falls back to the defaults instead of breaking", async () => {
  const fetchMock = setup("/?window=forever&regency=ID6101");

  await waitFor(() => expect(hotspotRequests(fetchMock)).toHaveLength(1));
  const request = lastHotspotRequest(fetchMock);
  expect(request.searchParams.get("window")).toBe("24h");
  // A Regency without a Province cannot be applied
  expect(request.searchParams.has("regency")).toBe(false);
});

test("an older, slower response never overwrites a newer one", async () => {
  let releaseFirst: (response: Response) => void = () => {};
  const first = new Promise<Response>((resolve) => (releaseFirst = resolve));
  const staleCollection = collection({
    ...SAMBAS_HOTSPOT,
    properties: { ...SAMBAS_HOTSPOT.properties, id: 99 },
  });
  const fresh = collection(SAMBAS_HOTSPOT);
  let hotspotCalls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      const json = (body: unknown) =>
        new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
      if (url.pathname === "/api/provinces") return json(PROVINCES);
      if (url.pathname === "/api/hotspots") {
        hotspotCalls += 1;
        return hotspotCalls === 1 ? first : json(fresh);
      }
      return new Response("not found", { status: 404 });
    }),
  );
  window.history.replaceState({}, "", "/");
  render(<App />);
  await screen.findByRole("option", { name: "Kalimantan Barat" });

  await userEvent.click(screen.getByRole("radio", { name: "48 jam" }));
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")[0]?.properties?.id).toBe(1));
  releaseFirst(
    new Response(JSON.stringify(staleCollection), { headers: { "Content-Type": "application/json" } }),
  );

  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(createdMaps[0].hotspotData("hotspots")[0].properties?.id).toBe(1);
});
