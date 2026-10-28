import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";

import App from "./App";
import { createdMaps, openPopups } from "./test/fakeMapLibre";
import { SAMBAS_HOTSPOT, collection } from "./test/hotspotFixtures";
import { mockApi } from "./test/mockApi";
import { installReducedMotion, setReducedMotion } from "./test/reducedMotion";

vi.mock("maplibre-gl", async () => (await import("./test/fakeMapLibre")).fakeMapLibreModule);

const KALBAR = { code: "ID61", name: "Kalimantan Barat" };

function setup() {
  window.history.replaceState({}, "", "/");
  mockApi({
    "/hotspots": collection(SAMBAS_HOTSPOT),
    "/hotspots/counts": [],
    "/provinces": [KALBAR],
    "/freshness": () =>
      new Response(JSON.stringify({ last_updated: "2026-10-16T07:00:00Z", stale: false }), {
        headers: { "Content-Type": "application/json" },
      }),
  });
  render(<App />);
}

beforeAll(installReducedMotion);

beforeEach(() => {
  createdMaps.length = 0;
  openPopups.length = 0;
});

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

test("with reduced motion a panel closes at once and opens at once", async () => {
  setReducedMotion(true);
  setup();
  const filter = screen.getByRole("button", { name: "Filter" });
  expect(screen.getByLabelText("Provinsi")).toBeVisible();

  await userEvent.click(filter);
  expect(screen.queryByLabelText("Provinsi")).toBeNull();

  await userEvent.click(filter);
  expect(screen.getByLabelText("Provinsi")).toBeVisible();
});

test("a panel eases open and shut, and its content is there to use once it has", async () => {
  setReducedMotion(false);
  setup();
  const filter = screen.getByRole("button", { name: "Filter" });

  await userEvent.click(filter);
  await waitFor(() => expect(screen.queryByLabelText("Provinsi")).toBeNull());

  await userEvent.click(filter);
  await waitFor(() => expect(screen.getByLabelText("Provinsi")).toBeVisible());
  await userEvent.selectOptions(screen.getByLabelText("Provinsi"), "ID61");
  expect(screen.getByLabelText("Provinsi")).toHaveValue("ID61");
});

test("keyboard focus stays on the panel's button when the panel opens or closes", async () => {
  setReducedMotion(false);
  setup();
  const filter = screen.getByRole("button", { name: "Filter" });

  filter.focus();
  await userEvent.keyboard("{Enter}");
  await waitFor(() => expect(screen.queryByLabelText("Provinsi")).toBeNull());
  expect(filter).toHaveFocus();

  await userEvent.keyboard("{Enter}");
  await waitFor(() => expect(screen.getByLabelText("Provinsi")).toBeVisible());
  expect(filter).toHaveFocus();
});

test("a chat message is on screen once it has arrived, and at once with reduced motion", async () => {
  setReducedMotion(true);
  setup();
  await userEvent.click(screen.getByRole("button", { name: "Tanya" }));

  expect(screen.getByRole("log", { name: "Percakapan" }).querySelector(".chat-message")).toBeVisible();
});
