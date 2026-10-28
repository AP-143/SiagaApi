import { render, screen } from "@testing-library/react";
import { beforeAll, expect, test } from "vitest";

import Brand from "./Brand";
import { installReducedMotion, setReducedMotion } from "./test/reducedMotion";

beforeAll(installReducedMotion);

test("the wordmark reads as one name, not as single letters", () => {
  setReducedMotion(false);
  render(<Brand theme="light" onToggleTheme={() => {}} />);

  const heading = screen.getByRole("heading", { level: 1, name: "SiagaApi" });
  const letters = Array.from(heading.querySelectorAll('[aria-hidden="true"]'), (l) => l.textContent);
  expect(letters.join("")).toBe("SiagaApi");
});

test("the wordmark rises in letter by letter when the map opens, and sits still with reduced motion", () => {
  setReducedMotion(false);
  const { unmount } = render(<Brand theme="light" onToggleTheme={() => {}} />);
  expect(screen.getByRole("heading", { level: 1 }).querySelector(".split-letter")).not.toBeVisible();
  unmount();

  setReducedMotion(true);
  render(<Brand theme="light" onToggleTheme={() => {}} />);
  for (const letter of screen.getByRole("heading", { level: 1 }).querySelectorAll(".split-letter")) {
    expect(letter).toBeVisible();
  }
});

test("a line under the name says what the map is for", () => {
  setReducedMotion(true);
  render(<Brand theme="light" onToggleTheme={() => {}} />);

  expect(screen.getByText("Pantau titik api Kalimantan")).toBeInTheDocument();
});
