import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, expect, test } from "vitest";

import { scrollTo } from "../test/fakeIntersectionObserver";
import { installReducedMotion, setReducedMotion } from "../test/reducedMotion";
import QuickFacts from "./QuickFacts";

beforeAll(installReducedMotion);

const letters = (container: HTMLElement) => container.querySelectorAll(".split-letter");

test("the title reads as 'Fakta singkat tentang titik api'", () => {
  setReducedMotion(false);
  render(<QuickFacts />);

  expect(
    screen.getByRole("heading", { level: 2, name: "Fakta singkat tentang titik api" }),
  ).toBeInTheDocument();
});

test("it explains that a Hotspot is a signal and not proof of fire", () => {
  setReducedMotion(false);
  render(<QuickFacts />);

  expect(screen.getByText(/bukan bukti/i)).toBeInTheDocument();
});

test("the table states where the data comes from, what it covers and how often it is renewed", () => {
  setReducedMotion(false);
  render(<QuickFacts />);

  const rows = within(screen.getByRole("table")).getAllByRole("row");
  expect(rows.map((row) => row.textContent)).toEqual([
    "Sumber dataNASA FIRMS, satelit VIIRS",
    "Wilayah5 provinsi Kalimantan",
    "PembaruanSetiap 30 menit",
    "Tingkat keyakinanRendah, nominal, tinggi",
  ]);
});

test("no live number appears, only the stated facts", () => {
  setReducedMotion(false);
  const { container } = render(<QuickFacts />);

  expect(container.textContent?.match(/\d+/g)).toEqual(["5", "30"]);
});

test("the badge leads to the map", () => {
  setReducedMotion(false);
  render(<QuickFacts />);

  expect(screen.getByRole("link", { name: "Buka peta" })).toHaveAttribute("href", "/peta");
});

test("the portrait photograph is described", () => {
  setReducedMotion(false);
  render(<QuickFacts />);

  expect(screen.getByRole("img", { name: /hutan rawa gambut/i })).toBeInTheDocument();
});

test("the title and the table wait out of sight until the section is scrolled to", async () => {
  setReducedMotion(false);
  const { container } = render(<QuickFacts />);

  expect(letters(container)[0]).not.toBeVisible();
  const firstRow = within(screen.getByRole("table")).getAllByRole("row")[0];
  expect(firstRow).not.toBeVisible();

  scrollTo(container.querySelector("section")!);

  await waitFor(() => expect(letters(container)[0]).toBeVisible());
  await waitFor(() => expect(firstRow).toBeVisible(), { timeout: 3000 });
});

test("with reduced motion everything is in place at once and nothing is clipped", () => {
  setReducedMotion(true);
  const { container } = render(<QuickFacts />);

  for (const letter of letters(container)) expect(letter).toBeVisible();
  for (const row of within(screen.getByRole("table")).getAllByRole("row")) {
    expect(row).toBeVisible();
  }
  expect(container.querySelector("figure")).not.toHaveStyle({ clipPath: "inset(100% 0% 0% 0%)" });
});
