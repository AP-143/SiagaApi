import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import Root from "./Root";
import { createdMaps, openPopups } from "./test/fakeMapLibre";
import { SAMBAS_HOTSPOT, collection } from "./test/hotspotFixtures";
import { mockApi } from "./test/mockApi";

vi.mock("maplibre-gl", async () => (await import("./test/fakeMapLibre")).fakeMapLibreModule);

function openAt(url: string) {
  window.history.replaceState({}, "", url);
  mockApi({ "/hotspots": collection(SAMBAS_HOTSPOT), "/hotspots/counts": [], "/provinces": [] });
  render(<Root />);
}

const landing = () => screen.queryByRole("main", { name: "Beranda SiagaApi" });
const mapTitle = () => screen.queryByRole("heading", { level: 1, name: "SiagaApi" });

beforeEach(() => {
  createdMaps.length = 0;
  openPopups.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

test("the front page shows the Landing, not the map", () => {
  openAt("/");

  expect(landing()).toBeInTheDocument();
  expect(mapTitle()).not.toBeInTheDocument();
});

test("/peta opens the map", async () => {
  openAt("/peta");

  expect(await screen.findByRole("heading", { level: 1, name: "SiagaApi" })).toBeInTheDocument();
  expect(landing()).not.toBeInTheDocument();
});

test("a link shared before the Landing existed still opens the map", async () => {
  openAt("/?province=ID62");

  expect(await screen.findByRole("heading", { level: 1, name: "SiagaApi" })).toBeInTheDocument();
  expect(landing()).not.toBeInTheDocument();
});

test("an address nobody planned for shows the Landing", () => {
  openAt("/tentang");

  expect(landing()).toBeInTheDocument();
  expect(mapTitle()).not.toBeInTheDocument();
});
