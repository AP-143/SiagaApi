import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "./App";
import { createdMaps, openPopups } from "./test/fakeMapLibre";
import { SAMBAS_HOTSPOT, collection } from "./test/hotspotFixtures";
import { mockApi } from "./test/mockApi";

vi.mock("maplibre-gl", async () => (await import("./test/fakeMapLibre")).fakeMapLibreModule);

const KALBAR = { code: "ID61", name: "Kalimantan Barat" };

/** A wide screen: the slim top bar applies, and nothing else in the page matches a media query. */
function wideScreen() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("min-width: 1000px"),
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
  wideScreen();
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

test("on a wide screen every panel starts closed so the map is all there is", async () => {
  setup();
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));

  for (const name of ["Filter", "Lapisan", "Ringkasan", "Tanya"]) {
    expect(screen.getByRole("button", { name })).toHaveAttribute("aria-expanded", "false");
  }
  expect(screen.queryByLabelText("Provinsi")).toBeNull();
});

test("on a wide screen opening a panel closes the one that was open", async () => {
  setup();
  await userEvent.click(screen.getByRole("button", { name: "Filter" }));
  expect(await screen.findByLabelText("Provinsi")).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Ringkasan" }));

  expect(screen.getByRole("button", { name: "Filter" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.getByRole("button", { name: "Ringkasan" })).toHaveAttribute("aria-expanded", "true");
  await waitFor(() => expect(screen.queryByLabelText("Provinsi")).toBeNull());
});
