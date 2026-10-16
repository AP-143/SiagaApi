import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "./App";
import { createdMaps, openPopups } from "./test/fakeMapLibre";
import { SAMBAS_HOTSPOT, collection } from "./test/hotspotFixtures";
import { mockApi } from "./test/mockApi";

vi.mock("maplibre-gl", async () => (await import("./test/fakeMapLibre")).fakeMapLibreModule);

function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

type Freshness = { last_updated: string | null; stale: boolean };

function setup(freshness: (call: number) => Response) {
  window.history.replaceState({}, "", "/");
  let freshnessCalls = 0;
  const fetchMock = mockApi({
    "/hotspots": collection(SAMBAS_HOTSPOT),
    "/hotspots/counts": [],
    "/provinces": [],
    "/freshness": () => freshness(++freshnessCalls),
  });
  render(<App />);
  return fetchMock;
}

const FRESH: Freshness = { last_updated: "2026-10-16T07:00:00Z", stale: false };
const STALE: Freshness = { last_updated: "2026-10-16T01:00:00Z", stale: true };

beforeEach(() => {
  createdMaps.length = 0;
  openPopups.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

test("the page says when the data was last updated", async () => {
  setup(() => json(FRESH));

  // 07:00 UTC is 14.00 in WIB
  expect(await screen.findByText(/Terakhir diperbarui: 16 Okt 2026, 14\.00 WIB/)).toBeInTheDocument();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("data older than six hours shows a warning but keeps the Hotspots on the map", async () => {
  setup(() => json(STALE));

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Data mungkin usang");
  expect(screen.getByText(/Terakhir diperbarui: 16 Okt 2026, 08\.00 WIB/)).toBeInTheDocument();
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));
});

test("data that has never been updated says so", async () => {
  setup(() => json({ last_updated: null, stale: true }));

  expect(await screen.findByRole("alert")).toHaveTextContent("belum pernah diperbarui");
});

test("when freshness cannot be checked the page warns instead of implying the data is current", async () => {
  setup(() => new Response("down", { status: 503 }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Tidak dapat memeriksa kesegaran data");
});

test("the warning goes away once fresh data arrives, without a page reload", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  setup((call) => json(call === 1 ? STALE : FRESH));
  expect(await screen.findByRole("alert")).toHaveTextContent("Data mungkin usang");

  await act(async () => {
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
  });

  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(screen.getByText(/Terakhir diperbarui: 16 Okt 2026, 14\.00 WIB/)).toBeInTheDocument();
});

test("the warning appears when data turns stale while the page stays open", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  setup((call) => json(call === 1 ? FRESH : STALE));
  await screen.findByText(/Terakhir diperbarui/);
  expect(screen.queryByRole("alert")).toBeNull();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
  });

  expect(await screen.findByRole("alert")).toHaveTextContent("Data mungkin usang");
});

test("if a refresh fails the last known Hotspots stay visible and a warning appears", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  let hotspotCalls = 0;
  window.history.replaceState({}, "", "/");
  mockApi({
    "/hotspots": () => (++hotspotCalls === 1 ? json(collection(SAMBAS_HOTSPOT)) : new Response("down", { status: 503 })),
    "/hotspots/counts": [],
    "/provinces": [],
    "/freshness": FRESH,
  });
  render(<App />);
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));

  await act(async () => {
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
  });

  expect(await screen.findByRole("alert")).toHaveTextContent("Tidak dapat memuat data terbaru");
  expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1);
});
