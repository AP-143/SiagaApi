import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "./App";
import { createdMaps, openPopups } from "./test/fakeMapLibre";
import { SAMBAS_HOTSPOT, collection } from "./test/hotspotFixtures";
import { mockApi } from "./test/mockApi";

vi.mock("maplibre-gl", async () => (await import("./test/fakeMapLibre")).fakeMapLibreModule);

function setup(url = "/") {
  window.history.replaceState({}, "", url);
  const fetchMock = mockApi({ "/hotspots": collection(SAMBAS_HOTSPOT), "/provinces": [] });
  render(<App />);
  return fetchMock;
}

function hotspotRequests(fetchMock: ReturnType<typeof mockApi>) {
  return fetchMock.mock.calls
    .map(([url]) => new URL(String(url), "http://localhost"))
    .filter((url) => url.pathname === "/api/hotspots");
}

/** Read a ["match", ["get", "confidence"], "low", a, "nominal", b, "high", c, fallback] expression. */
function valuesByConfidence(expression: unknown): Record<string, number> {
  const [operator, , ...pairs] = expression as unknown[];
  expect(operator).toBe("match");
  return {
    [pairs[0] as string]: pairs[1] as number,
    [pairs[2] as string]: pairs[3] as number,
    [pairs[4] as string]: pairs[5] as number,
  };
}

beforeEach(() => {
  createdMaps.length = 0;
  openPopups.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

test("low-Confidence Hotspots are not requested by default", async () => {
  const fetchMock = setup();

  await waitFor(() => expect(hotspotRequests(fetchMock)).toHaveLength(1));
  expect(screen.getByLabelText("Tampilkan kepercayaan rendah")).not.toBeChecked();
  expect(hotspotRequests(fetchMock)[0].searchParams.has("min_confidence")).toBe(false);
});

test("low-Confidence Hotspots can be switched on and off again", async () => {
  const fetchMock = setup();
  await waitFor(() => expect(hotspotRequests(fetchMock)).toHaveLength(1));

  await userEvent.click(screen.getByLabelText("Tampilkan kepercayaan rendah"));
  await waitFor(() =>
    expect(hotspotRequests(fetchMock).at(-1)!.searchParams.get("min_confidence")).toBe("low"),
  );
  expect(new URLSearchParams(window.location.search).get("low")).toBe("1");

  await userEvent.click(screen.getByLabelText("Tampilkan kepercayaan rendah"));
  await waitFor(() =>
    expect(hotspotRequests(fetchMock).at(-1)!.searchParams.has("min_confidence")).toBe(false),
  );
});

test("a shared address with low-Confidence switched on is restored", async () => {
  const fetchMock = setup("/?low=1");

  await waitFor(() =>
    expect(hotspotRequests(fetchMock)[0].searchParams.get("min_confidence")).toBe("low"),
  );
  expect(screen.getByLabelText("Tampilkan kepercayaan rendah")).toBeChecked();
});

test("a more confident Hotspot is drawn larger and more opaque", async () => {
  setup();
  await waitFor(() => expect(createdMaps[0].layers.length).toBeGreaterThan(0));

  const paint = createdMaps[0].layers.find((layer) => layer.id === "hotspots")!.paint as Record<string, unknown>;
  const radius = valuesByConfidence(paint["circle-radius"]);
  const opacity = valuesByConfidence(paint["circle-opacity"]);

  expect(radius.low).toBeLessThan(radius.nominal);
  expect(radius.nominal).toBeLessThan(radius.high);
  expect(opacity.low).toBeLessThan(opacity.nominal);
  expect(opacity.nominal).toBeLessThan(opacity.high);
});
