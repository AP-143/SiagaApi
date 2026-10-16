import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "./App";
import { createdMaps, openPopups } from "./test/fakeMapLibre";
import { SAMBAS_HOTSPOT, collection } from "./test/hotspotFixtures";
import { mockApi } from "./test/mockApi";

vi.mock("maplibre-gl", async () => (await import("./test/fakeMapLibre")).fakeMapLibreModule);

const KALBAR = { code: "ID61", name: "Kalimantan Barat" };
const KALTENG = { code: "ID62", name: "Kalimantan Tengah" };

function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

const COUNTS_24H = [
  { regency: { code: "ID6101", name: "Sambas" }, province: KALBAR, count: 12 },
  { regency: { code: "ID6271", name: "Palangka Raya" }, province: KALTENG, count: 3 },
  { regency: null, province: KALBAR, count: 1 },
];

function setup(counts: (url: URL) => Response = () => json(COUNTS_24H)) {
  window.history.replaceState({}, "", "/");
  const fetchMock = mockApi({
    "/hotspots": collection(SAMBAS_HOTSPOT),
    "/hotspots/counts": counts,
    "/provinces": [KALBAR, KALTENG],
  });
  render(<App />);
  return fetchMock;
}

function panel() {
  return screen.getByRole("region", { name: "Titik api per kabupaten/kota" });
}

beforeEach(() => {
  createdMaps.length = 0;
  openPopups.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

test("the panel lists each Regency with its number of Hotspots", async () => {
  setup();

  const sambas = await screen.findByText("Sambas");
  expect(sambas.closest("li")).toHaveTextContent("12");
  const palangkaRaya = screen.getByText("Palangka Raya");
  expect(palangkaRaya.closest("li")).toHaveTextContent("3");
});

test("Hotspots outside every Regency are listed as unknown", async () => {
  setup();

  const unknown = await screen.findByText("Kabupaten/kota tidak diketahui");
  expect(unknown.closest("li")).toHaveTextContent("1");
});

test("the panel shows the total number of Hotspots", async () => {
  setup();

  await screen.findByText("Sambas");

  expect(within(panel()).getByText(/Total/)).toHaveTextContent("16");
});

test("counts are described as Hotspots, never as fires", async () => {
  setup();

  await screen.findByText("Sambas");

  expect(panel().textContent).not.toMatch(/kebakaran/i);
  expect(panel().textContent).toMatch(/titik api/i);
});

test("the panel follows the filters", async () => {
  const fetchMock = setup((url) =>
    json(
      url.searchParams.get("window") === "7d"
        ? [{ regency: { code: "ID6101", name: "Sambas" }, province: KALBAR, count: 80 }]
        : COUNTS_24H,
    ),
  );
  await screen.findByText("Palangka Raya");

  await userEvent.click(screen.getByRole("radio", { name: "7 hari" }));

  await waitFor(() => expect(screen.queryByText("Palangka Raya")).toBeNull());
  expect(screen.getByText("Sambas").closest("li")).toHaveTextContent("80");
  const countRequests = fetchMock.mock.calls
    .map(([url]) => new URL(String(url), "http://localhost"))
    .filter((url) => url.pathname === "/api/hotspots/counts");
  expect(countRequests.at(-1)!.searchParams.get("window")).toBe("7d");
});

test("with no Hotspots the panel says so", async () => {
  setup(() => json([]));

  expect(await screen.findByText("Tidak ada titik api")).toBeInTheDocument();
});

test("if the counts cannot be loaded the rest of the map still works", async () => {
  setup(() => new Response("down", { status: 503 }));

  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));
  expect(screen.queryByText("Sambas")).toBeNull();
});

test("large counts use Indonesian thousands separators", async () => {
  setup(() =>
    json([
      { regency: { code: "ID6208", name: "Seruyan" }, province: KALTENG, count: 1027 },
      { regency: { code: "ID6101", name: "Sambas" }, province: KALBAR, count: 16 },
    ]),
  );

  expect((await screen.findByText("Seruyan")).closest("li")).toHaveTextContent("1.027");
  expect(within(panel()).getByText(/Total/)).toHaveTextContent("1.043");
});

test("each row has a bar sized relative to the busiest Regency", async () => {
  setup();
  await screen.findByText("Sambas");

  const width = (name: string) =>
    (screen.getByText(name).closest("li")!.querySelector(".bar-fill") as HTMLElement).style.width;

  expect(width("Sambas")).toBe("100%"); // 12, the busiest
  expect(width("Palangka Raya")).toBe("25%"); // 3 of 12
  // The smallest still gets a visible sliver
  expect(parseFloat(width("Kabupaten/kota tidak diketahui"))).toBeGreaterThan(0);
});
