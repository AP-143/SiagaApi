import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import ImageSlot from "./ImageSlot";

test("with no picture configured the slot shows its drawing", () => {
  render(<ImageSlot src={null} fallback={<svg data-testid="drawing" />} />);

  expect(screen.getByTestId("drawing")).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});

test("a configured picture replaces the drawing", () => {
  render(<ImageSlot src="/landing/hero-sky.webp" alt="Langit fajar" fallback={<svg data-testid="drawing" />} />);

  expect(screen.getByRole("img", { name: "Langit fajar" })).toHaveAttribute("src", "/landing/hero-sky.webp");
  expect(screen.queryByTestId("drawing")).not.toBeInTheDocument();
});

test("a picture with no description is decorative and hidden from assistive technology", () => {
  const { container } = render(<ImageSlot src="/landing/hero-sky.webp" fallback={null} />);

  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(container.querySelector("img")).toHaveAttribute("alt", "");
});
