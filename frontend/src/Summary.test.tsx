import { render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "./App";
import { createdMaps, openPopups } from "./test/fakeMapLibre";
import { SAMBAS_HOTSPOT, collection } from "./test/hotspotFixtures";
import { mockApi } from "./test/mockApi";

vi.mock("maplibre-gl", async () => (await import("./test/fakeMapLibre")).fakeMapLibreModule);

const ROWS = [
  {
    regency: { code: "ID6101", name: "Sambas" },
    province: { code: "ID61", name: "Kalimantan Barat" },
    count: 7,
  },
];

function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

/** `counts` is asked once per call; the test decides what each call gets. */
function setup(counts: (call: number) => Response) {
  window.history.replaceState({}, "", "/");
  let calls = 0;
  mockApi({
    "/hotspots": collection(SAMBAS_HOTSPOT),
    "/hotspots/counts": () => counts(++calls),
    "/provinces": [],
    "/freshness": { last_updated: "2026-10-16T07:00:00Z", stale: false },
  });
  render(<App />);
}

const FAILS = () => new Response("down", { status: 503 });

beforeEach(() => {
  createdMaps.length = 0;
  openPopups.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

test("when the summary cannot be loaded it does not claim there are no Hotspots", async () => {
  setup(FAILS);

  expect(await screen.findByText(/Tidak dapat memuat ringkasan/)).toBeInTheDocument();
  expect(screen.queryByText("Tidak ada titik api")).toBeNull();
});

test("an empty summary that did load still says there are none", async () => {
  setup(() => json([]));

  expect(await screen.findByText("Tidak ada titik api")).toBeInTheDocument();
  expect(screen.queryByText(/Tidak dapat memuat ringkasan/)).toBeNull();
});

test("a refresh that fails keeps the last numbers and says they may be old", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  setup((call) => (call === 1 ? json(ROWS) : FAILS()));
  expect(await screen.findByText("Sambas")).toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
  });

  expect(screen.getByText("Sambas")).toBeInTheDocument();
  expect(screen.getByText(/mungkin sudah lama/)).toBeInTheDocument();
});

test("the warning goes away once the summary loads again", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  setup((call) => (call === 2 ? FAILS() : json(ROWS)));
  await screen.findByText("Sambas");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
  });
  expect(screen.getByText(/mungkin sudah lama/)).toBeInTheDocument();

  await act(async () => {
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
  });

  expect(screen.queryByText(/mungkin sudah lama/)).toBeNull();
  expect(screen.getByText("Sambas")).toBeInTheDocument();
});
