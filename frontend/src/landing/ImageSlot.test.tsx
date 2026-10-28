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

test("a picture reserves its space and loads lazily unless it is the first thing on the page", () => {
  const { container, rerender } = render(<ImageSlot src="/a.webp" width={480} height={480} fallback={null} />);
  const img = () => container.querySelector("img")!;

  expect(img()).toHaveAttribute("width", "480");
  expect(img()).toHaveAttribute("height", "480");
  expect(img()).toHaveAttribute("loading", "lazy");

  rerender(<ImageSlot src="/a.webp" width={480} height={480} priority fallback={null} />);
  expect(img()).toHaveAttribute("loading", "eager");
  expect(img()).toHaveAttribute("fetchpriority", "high");
});

test("a picture can offer several sizes so a small screen takes the small one", () => {
  const { container } = render(
    <ImageSlot src="/a.webp" srcSet="/a-small.webp 800w, /a.webp 3000w" sizes="100vw" fallback={null} />,
  );

  expect(container.querySelector("img")).toHaveAttribute("srcset", "/a-small.webp 800w, /a.webp 3000w");
  expect(container.querySelector("img")).toHaveAttribute("sizes", "100vw");
});
