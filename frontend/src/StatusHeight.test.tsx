import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import App from "./App";
import { createdMaps, openPopups } from "./test/fakeMapLibre";
import { SAMBAS_HOTSPOT, collection } from "./test/hotspotFixtures";
import { mockApi } from "./test/mockApi";

vi.mock("maplibre-gl", async () => (await import("./test/fakeMapLibre")).fakeMapLibreModule);

/** A ResizeObserver that reports once as soon as something is watched, like a browser does. */
function stubResizeObserver() {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: () => void) {}
      observe() {
        this.callback();
      }
      disconnect() {}
      unobserve() {}
    },
  );
}

beforeEach(() => {
  createdMaps.length = 0;
  openPopups.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

test("the page tells the layout how tall the status pills are, so the rail can sit just under them", async () => {
  stubResizeObserver();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const height = this.classList.contains("status-bar") ? 52 : 0;
    return { height, width: 0, top: 0, left: 0, right: 0, bottom: height, x: 0, y: 0, toJSON() {} } as DOMRect;
  });
  window.history.replaceState({}, "", "/peta");
  mockApi({ "/hotspots": collection(SAMBAS_HOTSPOT), "/hotspots/counts": [], "/provinces": [] });

  const { container } = render(<App />);
  await waitFor(() => expect(createdMaps[0].hotspotData("hotspots")).toHaveLength(1));

  expect(screen.getByRole("heading", { level: 1, name: "SiagaApi" })).toBeInTheDocument();
  expect(container.querySelector<HTMLElement>(".app")!.style.getPropertyValue("--status-h")).toBe("52px");
});
