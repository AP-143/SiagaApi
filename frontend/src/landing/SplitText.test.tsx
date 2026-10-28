import { render, screen, waitFor } from "@testing-library/react";
import { beforeAll, expect, test } from "vitest";

import { scrollTo } from "../test/fakeIntersectionObserver";
import { installReducedMotion, setReducedMotion } from "../test/reducedMotion";
import SplitText from "./SplitText";

const prefersReducedMotion = setReducedMotion;

beforeAll(installReducedMotion);

test("a heading split into letters still reads as its whole text", () => {
  prefersReducedMotion(false);
  render(<SplitText as="h2" text="Titik api" />);

  expect(screen.getByRole("heading", { level: 2, name: "Titik api" })).toBeInTheDocument();
});

test("the letters are hidden from assistive technology so they are not read one by one", () => {
  prefersReducedMotion(false);
  render(<SplitText as="h2" text="Titik api" />);

  const heading = screen.getByRole("heading", { level: 2 });
  const hidden = heading.querySelectorAll('[aria-hidden="true"]');
  expect(Array.from(hidden, (letter) => letter.textContent).join("")).toBe("Titikapi");
});

test("the gap between words is kept so the text still wraps between words", () => {
  prefersReducedMotion(false);
  render(<SplitText as="h2" text="Titik api" />);

  const heading = screen.getByRole("heading", { level: 2 });
  expect(heading.textContent).toBe("Titik api");
});

test("the letters wait out of sight until the heading is scrolled to", () => {
  prefersReducedMotion(false);
  render(<SplitText as="h2" text="Api" />);

  const letters = screen.getByRole("heading").querySelectorAll('[aria-hidden="true"]');
  expect(letters).toHaveLength(3);
  for (const letter of letters) expect(letter).not.toBeVisible();
});

test("the letters appear once the heading is scrolled to", async () => {
  prefersReducedMotion(false);
  render(<SplitText as="h2" text="Api" />);

  scrollTo(screen.getByRole("heading"));

  const letters = screen.getByRole("heading").querySelectorAll('[aria-hidden="true"]');
  // The letters rise over most of a second, so wait for the first one to be seen.
  await waitFor(() => expect(letters[0]).toBeVisible());
});

test("a heading that plays on load needs no scrolling to appear", async () => {
  prefersReducedMotion(false);
  render(<SplitText as="h1" text="Api" on="load" />);

  const letters = screen.getByRole("heading").querySelectorAll('[aria-hidden="true"]');
  await waitFor(() => expect(letters[0]).toBeVisible());
});

test("with reduced motion every letter is in place at once", () => {
  prefersReducedMotion(true);
  render(<SplitText as="h2" text="Api" />);

  const letters = screen.getByRole("heading").querySelectorAll('[aria-hidden="true"]');
  expect(letters).toHaveLength(3);
  for (const letter of letters) expect(letter).toBeVisible();
});
