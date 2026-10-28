import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import Root from "../Root";

// Counts how often the map library is pulled in. This file only ever opens the Landing, so any
// count above zero means the Landing dragged the map along.
const mapLibre = vi.hoisted(() => ({ loads: 0 }));
vi.mock("maplibre-gl", async () => {
  mapLibre.loads += 1;
  return (await import("../test/fakeMapLibre")).fakeMapLibreModule;
});

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  window.history.replaceState({}, "", "/");
});

test("the Landing does not load the map library", async () => {
  window.history.replaceState({}, "", "/");
  render(<Root />);

  expect(await screen.findByRole("main", { name: "Beranda SiagaApi" })).toBeInTheDocument();
  expect(mapLibre.loads).toBe(0);
});

test("the Landing offers a way to the map", () => {
  window.history.replaceState({}, "", "/");
  render(<Root />);

  const links = screen.getAllByRole("link", { name: /buka peta/i });
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) expect(link).toHaveAttribute("href", "/peta");
});

test("a dark theme chosen on the map does not darken the Landing", () => {
  localStorage.setItem("siagaapi-theme", "dark");
  document.documentElement.dataset.theme = "dark";
  window.history.replaceState({}, "", "/");
  render(<Root />);

  expect(screen.getByRole("main", { name: "Beranda SiagaApi" })).toHaveAttribute(
    "data-theme",
    "light",
  );
  expect(screen.queryByRole("button", { name: /tema/i })).not.toBeInTheDocument();
});

test("nowhere does the Landing call a Hotspot a confirmed fire", () => {
  window.history.replaceState({}, "", "/");
  const { container } = render(<Root />);

  const text = container.textContent ?? "";
  expect(text).toMatch(/bukan bukti/i);
  expect(text).not.toMatch(/(dikonfirmasi|terkonfirmasi|pasti (ada )?(api|kebakaran))/i);
});
