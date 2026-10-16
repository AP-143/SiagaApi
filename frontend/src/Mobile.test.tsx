import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "./App";
import { createdMaps, openPopups } from "./test/fakeMapLibre";
import { SAMBAS_HOTSPOT, collection } from "./test/hotspotFixtures";
import { mockApi } from "./test/mockApi";
import { popupFields } from "./test/popup";

vi.mock("maplibre-gl", async () => (await import("./test/fakeMapLibre")).fakeMapLibreModule);

const KALBAR = { code: "ID61", name: "Kalimantan Barat" };

function viewport(phone: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: phone,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

function setup() {
  window.history.replaceState({}, "", "/");
  const fetchMock = mockApi({
    "/hotspots": collection(SAMBAS_HOTSPOT),
    "/hotspots/counts": [{ regency: { code: "ID6101", name: "Sambas" }, province: KALBAR, count: 7 }],
    "/provinces": [KALBAR],
    "/provinces/ID61/regencies": [{ code: "ID6101", name: "Sambas" }],
    "/freshness": () => json({ last_updated: "2026-10-16T07:00:00Z", stale: false }),
  });
  render(<App />);
  return fetchMock;
}

beforeEach(() => {
  createdMaps.length = 0;
  openPopups.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

test("on a phone the filters and the summary start closed so the map stays visible", async () => {
  viewport(true);
  setup();
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));

  expect(screen.getByRole("button", { name: "Filter" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("button", { name: "Ringkasan" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByLabelText("Provinsi")).toBeNull();
  expect(screen.queryByText("Sambas")).toBeNull();
});

test("on a phone the filters open on demand and can be used", async () => {
  viewport(true);
  const fetchMock = setup();
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));

  await userEvent.click(screen.getByRole("button", { name: "Filter" }));
  await screen.findByRole("option", { name: "Kalimantan Barat" });
  await userEvent.selectOptions(screen.getByLabelText("Provinsi"), "Kalimantan Barat");

  await waitFor(() => {
    const last = fetchMock.mock.calls
      .map(([url]) => new URL(String(url), "http://localhost"))
      .filter((url) => url.pathname === "/api/hotspots")
      .at(-1)!;
    expect(last.searchParams.get("province")).toBe("ID61");
  });
});

test("on a phone the summary opens on demand and shows the counts", async () => {
  viewport(true);
  setup();

  await userEvent.click(screen.getByRole("button", { name: "Ringkasan" }));

  expect((await screen.findByText("Sambas")).closest("li")).toHaveTextContent("7");
  expect(screen.getByRole("button", { name: "Ringkasan" })).toHaveAttribute("aria-expanded", "true");
});

test("on a phone tapping a Hotspot still shows its popup", async () => {
  viewport(true);
  setup();
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));

  createdMaps[0].tap("hotspots", 1, [110.25, 0.25]);

  expect(popupFields(openPopups[0].content!)["Kabupaten/Kota"]).toBe("Sambas");
});

test("on a wide screen the filters and the summary start open", async () => {
  viewport(false);
  setup();

  expect(await screen.findByLabelText("Provinsi")).toBeInTheDocument();
  expect(await screen.findByText("Sambas")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Filter" })).toHaveAttribute("aria-expanded", "true");
});

test("a panel can be closed again", async () => {
  viewport(false);
  setup();
  await screen.findByLabelText("Provinsi");

  await userEvent.click(screen.getByRole("button", { name: "Filter" }));

  expect(screen.queryByLabelText("Provinsi")).toBeNull();
});

test("the legend explains the colors and sizes", async () => {
  viewport(false);
  setup();

  const legend = await screen.findByRole("region", { name: "Keterangan" });

  expect(legend).toHaveTextContent(/ungu.*lahan gambut/i);
  expect(legend).toHaveTextContent(/jingga/i);
  expect(legend).toHaveTextContent(/kepercayaan/i);
});

test("the data sources are credited as their licenses require", async () => {
  viewport(true);
  setup();

  const credits = await screen.findByText(/NASA FIRMS/);

  expect(credits).toHaveTextContent("OCHA");
  expect(credits).toHaveTextContent("BPS");
  expect(credits).toHaveTextContent("CC BY-IGO");
  // Peatland: the Kementan (BBSDLP) map, served through BIG Satu Peta
  expect(credits).toHaveTextContent("Kementerian Pertanian");
  expect(credits).toHaveTextContent("Satu Peta");
});

test("no interface text is left in English", async () => {
  viewport(false);
  setup();
  await screen.findByText("Sambas");
  await screen.findByText(/Terakhir diperbarui/);

  const visibleText = document.body.textContent ?? "";
  const englishLeftovers = visibleText.match(
    /\b(Province|Regency|Last updated|Loading|Error|Select|Show only|All provinces|Updated)\b/g,
  );

  expect(englishLeftovers).toBeNull();
  expect(within(document.body).getByLabelText("Peta Kalimantan")).toBeInTheDocument();
});

test("on a phone opening one panel closes the other so they never cover each other", async () => {
  viewport(true);
  setup();
  await userEvent.click(screen.getByRole("button", { name: "Filter" }));
  expect(await screen.findByLabelText("Provinsi")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Ringkasan" }));

  expect(screen.getByRole("button", { name: "Ringkasan" })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("button", { name: "Filter" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByLabelText("Provinsi")).toBeNull();
});

test("on a wide screen closing one panel leaves the other open", async () => {
  viewport(false);
  setup();
  await screen.findByLabelText("Provinsi");
  await screen.findByText("Sambas");

  await userEvent.click(screen.getByRole("button", { name: "Filter" }));

  expect(screen.queryByLabelText("Provinsi")).toBeNull();
  expect(screen.getByText("Sambas")).toBeInTheDocument();
});

test("on a phone the map layers get their own panel, closed to begin with", async () => {
  viewport(true);
  setup();
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));

  expect(screen.getByRole("button", { name: "Lapisan" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByLabelText("Area lahan gambut")).toBeNull();
  expect(screen.queryByRole("radio", { name: "Satelit" })).toBeNull();
});

test("on a phone opening the layers panel shows its controls and closes the others", async () => {
  viewport(true);
  setup();
  await userEvent.click(screen.getByRole("button", { name: "Filter" }));
  expect(await screen.findByLabelText("Provinsi")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Lapisan" }));

  expect(screen.getByLabelText("Area lahan gambut")).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Satelit" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Filter" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByLabelText("Provinsi")).toBeNull();
});

test("the filters no longer carry the layer switches, so they stay short enough for a phone", async () => {
  viewport(false);
  setup();
  const filterPanel = (await screen.findByLabelText("Provinsi")).closest(".filter-panel") as HTMLElement;

  expect(within(filterPanel).queryByLabelText("Area lahan gambut")).toBeNull();
  expect(within(filterPanel).queryByRole("radio", { name: "Satelit" })).toBeNull();
});

test("on a wide screen the layers panel starts open", async () => {
  viewport(false);
  setup();

  expect(await screen.findByLabelText("Area lahan gambut")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Lapisan" })).toHaveAttribute("aria-expanded", "true");
});

test("on a phone opening the chat closes the other panels", async () => {
  viewport(true);
  setup();
  await userEvent.click(screen.getByRole("button", { name: "Filter" }));
  expect(await screen.findByLabelText("Provinsi")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Tanya" }));

  expect(screen.getByRole("textbox", { name: "Pertanyaan" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Filter" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByLabelText("Provinsi")).toBeNull();
});

// ---- The legend belongs to the map, not to the filter panel -------------------------------------

test("the legend is still there when the filter panel is closed", async () => {
  viewport(false);
  setup();
  await screen.findByLabelText("Provinsi");

  await userEvent.click(screen.getByRole("button", { name: "Filter" }));

  const legend = screen.getByRole("region", { name: "Keterangan" });
  expect(legend).toHaveTextContent(/jingga/i);
  expect(legend).toHaveTextContent(/ungu.*lahan gambut/i);
});

test("the legend is not part of the filter panel", async () => {
  viewport(false);
  setup();
  await screen.findByLabelText("Provinsi");

  const filterPanel = screen.getByRole("button", { name: "Filter" }).closest("section")!;

  expect(within(filterPanel).queryByRole("region", { name: "Keterangan" })).toBeNull();
});

test("on a wide screen the legend starts open and can be folded away", async () => {
  viewport(false);
  setup();
  const legend = await screen.findByRole("region", { name: "Keterangan" });
  const toggle = within(legend).getByRole("button", { name: "Keterangan" });
  expect(toggle).toHaveAttribute("aria-expanded", "true");

  await userEvent.click(toggle);

  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(within(legend).queryByText(/jingga/i)).toBeNull();
});

test("on a phone the legend starts folded, opens from its own button, and leaves the other panels alone", async () => {
  viewport(true);
  setup();
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));
  const legend = screen.getByRole("region", { name: "Keterangan" });
  const toggle = within(legend).getByRole("button", { name: "Keterangan" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(within(legend).queryByText(/jingga/i)).toBeNull();

  await userEvent.click(toggle);

  expect(within(legend).getByText(/jingga/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Filter" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("button", { name: "Ringkasan" })).toHaveAttribute("aria-expanded", "false");
});

test("opening a panel on a phone does not fold the legend away", async () => {
  viewport(true);
  setup();
  const legend = await screen.findByRole("region", { name: "Keterangan" });
  await userEvent.click(within(legend).getByRole("button", { name: "Keterangan" }));

  await userEvent.click(screen.getByRole("button", { name: "Filter" }));

  expect(within(legend).getByText(/jingga/i)).toBeInTheDocument();
});

test("the legend still explains the layers that are switched on", async () => {
  viewport(false);
  setup();
  const legend = await screen.findByRole("region", { name: "Keterangan" });

  expect(within(legend).getByText(/Garis tebal: batas provinsi/)).toBeInTheDocument();
  expect(within(legend).queryByText(/Garis tipis: batas kabupaten/)).toBeNull();
});
