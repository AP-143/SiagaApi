import { render, screen, waitFor } from "@testing-library/react";
import { beforeAll, expect, test } from "vitest";

import { scrollTo } from "../test/fakeIntersectionObserver";
import { installReducedMotion, setReducedMotion } from "../test/reducedMotion";
import Statement from "./Statement";

beforeAll(installReducedMotion);

const letters = (container: HTMLElement) => container.querySelectorAll(".split-letter");

test("the statement reads as one sentence", () => {
  setReducedMotion(false);
  render(<Statement />);

  expect(
    screen.getByRole("heading", { level: 2, name: "Satelit memantau titik panas di Kalimantan" }),
  ).toBeInTheDocument();
});

test("a rust label introduces it", () => {
  setReducedMotion(false);
  render(<Statement />);

  expect(screen.getByText(/satelit dan bumi/i)).toBeInTheDocument();
});

test("the round pictures and the emblem are decoration, hidden from assistive technology", () => {
  setReducedMotion(false);
  const { container } = render(<Statement />);

  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(container.querySelectorAll(".statement-pill")).toHaveLength(2);
  for (const decoration of container.querySelectorAll(".statement-pill, .statement-emblem")) {
    expect(decoration.closest('[aria-hidden="true"]')).not.toBeNull();
  }
});

test("the letters wait out of sight until the statement is scrolled to", async () => {
  setReducedMotion(false);
  const { container } = render(<Statement />);

  expect(letters(container)[0]).not.toBeVisible();

  scrollTo(container.querySelector("section")!);

  await waitFor(() => expect(letters(container)[0]).toBeVisible());
});

test("with reduced motion everything is in place at once", () => {
  setReducedMotion(true);
  const { container } = render(<Statement />);

  expect(letters(container).length).toBeGreaterThan(0);
  for (const letter of letters(container)) expect(letter).toBeVisible();
  for (const pill of container.querySelectorAll(".statement-pill, .statement-emblem")) {
    expect(pill).toBeVisible();
  }
});
