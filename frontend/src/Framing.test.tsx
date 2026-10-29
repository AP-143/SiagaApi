import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "./App";
import { KALIMANTAN_BOUNDS } from "./map/kalimantan";
import { createdMaps, openPopups } from "./test/fakeMapLibre";
import { SAMBAS_HOTSPOT, collection } from "./test/hotspotFixtures";
import { mockApi } from "./test/mockApi";

vi.mock("maplibre-gl", async () => (await import("./test/fakeMapLibre")).fakeMapLibreModule);

function setup() {
  window.history.replaceState({}, "", "/peta");
  mockApi({ "/hotspots": collection(SAMBAS_HOTSPOT), "/hotspots/counts": [], "/provinces": [] });
  render(<App />);
}

beforeEach(() => {
  createdMaps.length = 0;
  openPopups.length = 0;
});

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

test("once the map has loaded it is framed on Kalimantan, with room left for the top bar", async () => {
  setup();
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));

  const [frame] = createdMaps[0].fitBoundsCalls;
  expect(frame.bounds).toEqual(KALIMANTAN_BOUNDS);
  expect(frame.options.animate).toBe(false);
  expect(frame.options.padding.top).toBeGreaterThanOrEqual(64);
});

test("a button brings the map back to Kalimantan after it has been moved away", async () => {
  setup();
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));
  const before = createdMaps[0].fitBoundsCalls.length;

  await userEvent.click(screen.getByRole("button", { name: "Tampilkan seluruh Kalimantan" }));

  expect(createdMaps[0].fitBoundsCalls).toHaveLength(before + 1);
  const again = createdMaps[0].fitBoundsCalls.at(-1)!;
  expect(again.bounds).toEqual(KALIMANTAN_BOUNDS);
  expect(again.options.animate).not.toBe(false);
});

test("the map's own attribution button is off, so the data-sources chip is the only info button", async () => {
  setup();
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));

  expect(createdMaps[0].options.attributionControl).toBe(false);
});

test("zoom in, zoom out and show-all are three buttons of one group", async () => {
  setup();
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));

  const group = screen.getByRole("group", { name: "Kontrol peta" });
  const names = Array.from(group.querySelectorAll("button"), (b) => b.getAttribute("aria-label"));
  expect(names).toEqual(["Perbesar", "Perkecil", "Tampilkan seluruh Kalimantan"]);
});

test("the zoom buttons zoom the map", async () => {
  setup();
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));

  await userEvent.click(screen.getByRole("button", { name: "Perbesar" }));
  await userEvent.click(screen.getByRole("button", { name: "Perkecil" }));

  expect(createdMaps[0].zoomCalls).toEqual(["in", "out"]);
});
