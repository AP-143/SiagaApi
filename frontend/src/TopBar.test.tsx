import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "./App";
import { createdMaps, openPopups } from "./test/fakeMapLibre";
import { SAMBAS_HOTSPOT, collection } from "./test/hotspotFixtures";
import { mockApi } from "./test/mockApi";

vi.mock("maplibre-gl", async () => (await import("./test/fakeMapLibre")).fakeMapLibreModule);

const KALBAR = { code: "ID61", name: "Kalimantan Barat" };

/** A browser: the bar layout applies at every width, and nothing else matches a media query. */
function browserScreen() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("min-width: 1px"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

function setup() {
  window.history.replaceState({}, "", "/peta");
  mockApi({
    "/hotspots": collection(SAMBAS_HOTSPOT),
    "/hotspots/counts": [{ regency: { code: "ID6101", name: "Sambas" }, province: KALBAR, count: 7 }],
    "/provinces": [KALBAR],
  });
  render(<App />);
}

beforeEach(() => {
  createdMaps.length = 0;
  openPopups.length = 0;
  browserScreen();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

test("every panel starts closed so the map is all there is", async () => {
  setup();
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));

  for (const name of ["Filter", "Lapisan", "Ringkasan", "Tanya"]) {
    expect(screen.getByRole("button", { name })).toHaveAttribute("aria-expanded", "false");
  }
  expect(screen.queryByLabelText("Provinsi")).toBeNull();
});

test("opening a panel closes the one that was open", async () => {
  setup();
  await userEvent.click(screen.getByRole("button", { name: "Filter" }));
  expect(await screen.findByLabelText("Provinsi")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Ringkasan" }));

  expect(screen.getByRole("button", { name: "Filter" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("button", { name: "Ringkasan" })).toHaveAttribute("aria-expanded", "true");
  await waitFor(() => expect(screen.queryByLabelText("Provinsi")).toBeNull());
});

test("Escape closes the open panel and puts focus back on its button", async () => {
  setup();
  const filter = screen.getByRole("button", { name: "Filter" });
  await userEvent.click(filter);
  expect(await screen.findByLabelText("Provinsi")).toBeInTheDocument();

  await userEvent.keyboard("{Escape}");

  expect(filter).toHaveAttribute("aria-expanded", "false");
  expect(filter).toHaveFocus();
});

test("pressing outside the panels closes the open one, pressing inside does not", async () => {
  setup();
  await userEvent.click(screen.getByRole("button", { name: "Filter" }));
  const province = await screen.findByLabelText("Provinsi");

  fireEvent.pointerDown(province);
  expect(screen.getByRole("button", { name: "Filter" })).toHaveAttribute("aria-expanded", "true");

  fireEvent.pointerDown(document.body);
  expect(screen.getByRole("button", { name: "Filter" })).toHaveAttribute("aria-expanded", "false");
});

test("each panel button says which content it controls", async () => {
  setup();
  const filter = screen.getByRole("button", { name: "Filter" });
  await userEvent.click(filter);
  const body = await screen.findByLabelText("Provinsi");

  expect(filter.getAttribute("aria-controls")).toBeTruthy();
  expect(body.closest(`[id="${filter.getAttribute("aria-controls")}"]`)).not.toBeNull();
});

test("the legend starts as just its title", async () => {
  setup();
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));

  expect(screen.getByRole("button", { name: "Keterangan" })).toHaveAttribute("aria-expanded", "false");
});
