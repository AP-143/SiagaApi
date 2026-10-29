import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { installReducedMotion, setReducedMotion } from "../test/reducedMotion";
import Hero from "./Hero";
import { SLIDE_INTERVAL_MS } from "./HeroSlides";
import { LANDING_IMAGES } from "./images";

const COUNT = LANDING_IMAGES.heroSlides.length;

beforeEach(() => {
  installReducedMotion();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
});
afterEach(() => vi.useRealTimers());

function states(container: HTMLElement) {
  return [...container.querySelectorAll(".hero-slide")].map((slide) => slide.getAttribute("data-state"));
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

test("the hero holds three photographs and opens on the first", () => {
  setReducedMotion(false);
  const { container } = render(<Hero />);

  expect(COUNT).toBe(3);
  expect(states(container)).toEqual(["current", "waiting", "waiting"]);
});

test("the photographs are decoration, so they have no description", () => {
  setReducedMotion(false);
  const { container } = render(<Hero />);

  for (const image of container.querySelectorAll(".hero-slide img")) expect(image).toHaveAttribute("alt", "");
});

test("the next photograph slides in by itself, and the first comes round again after the last", () => {
  setReducedMotion(false);
  const { container } = render(<Hero />);

  advance(SLIDE_INTERVAL_MS);
  expect(states(container)).toEqual(["previous", "current", "waiting"]);

  advance(SLIDE_INTERVAL_MS);
  expect(states(container)).toEqual(["waiting", "previous", "current"]);

  advance(SLIDE_INTERVAL_MS);
  expect(states(container)).toEqual(["current", "waiting", "previous"]);
});

test("choosing a bar shows that photograph and starts its time again", () => {
  setReducedMotion(false);
  const { container } = render(<Hero />);

  advance(SLIDE_INTERVAL_MS - 100);
  fireEvent.click(screen.getByRole("button", { name: "Foto 3 dari 3" }));
  expect(states(container)).toEqual(["previous", "waiting", "current"]);

  advance(SLIDE_INTERVAL_MS - 100); // would have moved on if the clock had not started again
  expect(states(container)).toEqual(["previous", "waiting", "current"]);
  advance(100);
  expect(states(container)).toEqual(["current", "waiting", "previous"]);
});

test("each bar is a labelled button and the one showing says so", () => {
  setReducedMotion(false);
  render(<Hero />);

  const buttons = screen.getAllByRole("button", { name: /^Foto \d dari 3$/ });
  expect(buttons).toHaveLength(3);
  expect(buttons[0]).toHaveAttribute("aria-current", "true");
  expect(buttons[1]).not.toHaveAttribute("aria-current");
});

test("for a visitor who asked for less motion the photographs wait to be chosen", () => {
  setReducedMotion(true);
  const { container } = render(<Hero />);

  advance(SLIDE_INTERVAL_MS * 3);
  expect(states(container)).toEqual(["current", "waiting", "waiting"]);

  fireEvent.click(screen.getByRole("button", { name: "Foto 2 dari 3" }));
  expect(states(container)).toEqual(["previous", "current", "waiting"]);
});

test("nothing moves on while the tab is in the background", () => {
  setReducedMotion(false);
  const { container } = render(<Hero />);

  Object.defineProperty(document, "hidden", { configurable: true, value: true });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  advance(SLIDE_INTERVAL_MS * 2);
  expect(states(container)).toEqual(["current", "waiting", "waiting"]);

  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  advance(SLIDE_INTERVAL_MS);
  expect(states(container)).toEqual(["previous", "current", "waiting"]);
});
