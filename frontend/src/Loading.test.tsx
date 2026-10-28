import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "./App";
import { createdMaps, openPopups } from "./test/fakeMapLibre";
import { SAMBAS_HOTSPOT, collection } from "./test/hotspotFixtures";

vi.mock("maplibre-gl", async () => (await import("./test/fakeMapLibre")).fakeMapLibreModule);

function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

/** Hotspot responses wait until the test releases them, so "loading" can be observed. */
function setupWithSlowHotspots() {
  const waiting: Array<(response: Response) => void> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input), "http://localhost").pathname.replace(/^\/api/, "");
      if (path === "/hotspots") return new Promise<Response>((resolve) => waiting.push(resolve));
      if (path === "/provinces") return json([]);
      if (path === "/hotspots/counts") return json([]);
      return new Response("not found", { status: 404 });
    }),
  );
  window.history.replaceState({}, "", "/");
  render(<App />);
  const release = () => waiting.shift()!(json(collection(SAMBAS_HOTSPOT)));
  return { release };
}

beforeEach(() => {
  createdMaps.length = 0;
  openPopups.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

test("the page says the Hotspots are loading until they arrive", async () => {
  const { release } = setupWithSlowHotspots();

  // The whole suite runs in parallel, so allow a slow machine more than the default second.
  expect(await screen.findByRole("status", {}, { timeout: 5000 })).toHaveTextContent("Memuat titik api");

  release();

  await waitFor(() => expect(screen.queryByText(/Memuat titik api/)).toBeNull());
  expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1);
});

test("changing a filter shows the loading message again", async () => {
  const { release } = setupWithSlowHotspots();
  await screen.findByText(/Memuat titik api/, {}, { timeout: 5000 });
  release();
  await waitFor(() => expect(screen.queryByText(/Memuat titik api/)).toBeNull());

  await userEvent.click(screen.getByRole("radio", { name: "7 hari" }));

  expect(await screen.findByText(/Memuat titik api/, {}, { timeout: 5000 })).toBeInTheDocument();
});

test("a failed load stops the loading message", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("down", { status: 503 })),
  );
  window.history.replaceState({}, "", "/");
  render(<App />);

  await waitFor(() => expect(screen.queryByText(/Memuat titik api/)).toBeNull());
  expect(await screen.findByText(/Tidak dapat memuat data terbaru/, {}, { timeout: 5000 })).toBeInTheDocument();
});
