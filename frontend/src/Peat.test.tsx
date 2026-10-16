import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "./App";
import { createdMaps, openPopups } from "./test/fakeMapLibre";
import { PEAT_HOTSPOT, SAMBAS_HOTSPOT, collection } from "./test/hotspotFixtures";
import { mockApi } from "./test/mockApi";
import { popupFields } from "./test/popup";

vi.mock("maplibre-gl", async () => (await import("./test/fakeMapLibre")).fakeMapLibreModule);

function setup(url = "/") {
  window.history.replaceState({}, "", url);
  const fetchMock = mockApi({
    "/hotspots": collection(SAMBAS_HOTSPOT, PEAT_HOTSPOT),
    "/provinces": [],
  });
  render(<App />);
  return fetchMock;
}

function hotspotRequests(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .map(([url]) => new URL(String(url), "http://localhost"))
    .filter((url) => url.pathname === "/api/hotspots");
}

beforeEach(() => {
  createdMaps.length = 0;
  openPopups.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

test("the popup says when a Hotspot is on peatland", async () => {
  setup();
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(2));

  createdMaps[0].tap("hotspots", 4, [112.25, -1.75]);

  expect(popupFields(openPopups[0].content!)["Lahan gambut"]).toBe("Ya");
});

test("the popup says when a Hotspot is not on peatland", async () => {
  setup();
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(2));

  createdMaps[0].tap("hotspots", 1, [110.25, 0.25]);

  expect(popupFields(openPopups[0].content!)["Lahan gambut"]).toBe("Tidak");
});

test("only peat Hotspots are requested when the toggle is on", async () => {
  const fetchMock = setup();
  await waitFor(() => expect(hotspotRequests(fetchMock)).toHaveLength(1));
  expect(screen.getByLabelText("Hanya titik api di lahan gambut")).not.toBeChecked();
  expect(hotspotRequests(fetchMock)[0].searchParams.has("peat_only")).toBe(false);

  await userEvent.click(screen.getByLabelText("Hanya titik api di lahan gambut"));

  await waitFor(() =>
    expect(hotspotRequests(fetchMock).at(-1)!.searchParams.get("peat_only")).toBe("true"),
  );
  expect(new URLSearchParams(window.location.search).get("peat")).toBe("1");
});

test("a shared address with the peat toggle on is restored", async () => {
  const fetchMock = setup("/?peat=1");

  await waitFor(() =>
    expect(hotspotRequests(fetchMock)[0].searchParams.get("peat_only")).toBe("true"),
  );
  expect(screen.getByLabelText("Hanya titik api di lahan gambut")).toBeChecked();
});

test("peat Hotspots are drawn in a different color from the others", async () => {
  setup();
  await waitFor(() => expect(createdMaps[0].layers.length).toBeGreaterThan(0));

  const paint = createdMaps[0].layers.find((layer) => layer.id === "hotspots")!.paint as Record<string, unknown>;
  // ["case", ["get", "peat_hotspot"], peatColor, otherColor]
  const [operator, condition, peatColor, otherColor] = paint["circle-color"] as unknown[];
  expect(operator).toBe("case");
  expect(condition).toEqual(["get", "peat_hotspot"]);
  expect(peatColor).not.toEqual(otherColor);
});
