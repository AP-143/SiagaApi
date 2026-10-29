import { render, screen } from "@testing-library/react";
import { beforeAll, expect, test } from "vitest";

import { installReducedMotion, setReducedMotion } from "../test/reducedMotion";
import Hero from "./Hero";

beforeAll(installReducedMotion);

test("the title reads as 'Titik api' and is the page's main heading", () => {
  setReducedMotion(false);
  render(<Hero />);

  expect(screen.getByRole("heading", { level: 1, name: "Titik api" })).toBeInTheDocument();
});

test("an eyebrow names the subject above the title", () => {
  setReducedMotion(false);
  render(<Hero />);

  expect(screen.getByText(/hotspot kalimantan/i)).toBeInTheDocument();
});

test("the nav names the site and links to the map", () => {
  setReducedMotion(false);
  render(<Hero />);

  expect(screen.getByText("SiagaApi")).toBeInTheDocument();
  expect(screen.getByText(/pemantau titik api kalimantan/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Buka peta" })).toHaveAttribute("href", "/peta");
});

test("the pill at the bottom links to the map", () => {
  setReducedMotion(false);
  render(<Hero />);

  expect(screen.getByRole("link", { name: "Lihat di peta" })).toHaveAttribute("href", "/peta");
});

test("the decorative illustration is hidden from assistive technology", () => {
  setReducedMotion(false);
  render(<Hero />);

  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

test("the nav and the pill wait to be faded in while the page is loading", () => {
  setReducedMotion(false);
  render(<Hero />);

  expect(screen.getByRole("link", { name: "Buka peta" })).not.toBeVisible();
  expect(screen.getByRole("link", { name: "Lihat di peta" })).not.toBeVisible();
});

test("with reduced motion everything is on screen at once", () => {
  setReducedMotion(true);
  render(<Hero />);

  expect(screen.getByRole("link", { name: "Buka peta" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Lihat di peta" })).toBeVisible();
  expect(screen.getByText(/hotspot kalimantan/i)).toBeVisible();
  for (const letter of screen.getByRole("heading", { level: 1 }).querySelectorAll("[aria-hidden]")) {
    expect(letter).toBeVisible();
  }
});
