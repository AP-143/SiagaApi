import { render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { installReducedMotion, setReducedMotion } from "../test/reducedMotion";
import Embers, { emberBrightness, emberCount, emberProgress, spawnEmber, stepEmber } from "./Embers";

beforeEach(installReducedMotion);
afterEach(() => vi.unstubAllGlobals());

test("an ember starts in the lower part of the canvas and rises as it ages", () => {
  const ember = spawnEmber(1000, 600, () => 0.5);
  expect(ember.y).toBeGreaterThanOrEqual(600 * 0.55);
  expect(ember.age).toBe(0);

  const before = ember.y;
  stepEmber(ember, 1);

  expect(ember.y).toBeLessThan(before);
  expect(ember.age).toBe(1);
});

test("the first embers are spread over their lives so the screen is not empty at the start", () => {
  const ages = [0.1, 0.5, 0.9].map((r) => {
    const values = [0.2, 0.2, 0.2, 0.2, 0.2, 0.2, r];
    return spawnEmber(1000, 600, () => values.shift() ?? r, true).age;
  });

  expect(new Set(ages).size).toBe(3);
  expect(spawnEmber(1000, 600, Math.random, false).age).toBe(0);
});

test("an ember is dark when new, brightest in the middle of its life and dark again when it has burnt out", () => {
  expect(emberBrightness(0)).toBeCloseTo(0);
  expect(emberBrightness(0.5)).toBeGreaterThan(0.9);
  expect(emberBrightness(1)).toBeCloseTo(0);
  expect(emberProgress({ ...spawnEmber(100, 100, () => 0.5), age: 99 })).toBe(1);
});

test("a phone gets fewer embers than a wide screen, and never none or a crowd", () => {
  expect(emberCount(390)).toBeLessThan(emberCount(1440));
  expect(emberCount(100)).toBeGreaterThan(0);
  expect(emberCount(5000)).toBeLessThanOrEqual(90);
});

test("the canvas is decoration, hidden from assistive technology", () => {
  setReducedMotion(false);
  const { container } = render(<Embers />);

  expect(container.querySelector("canvas")).toHaveAttribute("aria-hidden", "true");
});

test("for a visitor who asked for less motion nothing is drawn", () => {
  setReducedMotion(true);
  const { container } = render(<Embers />);

  expect(container.querySelector("canvas")).toBeNull();
});

test("when it can draw it stamps every ember on each frame, and stops when it is removed", () => {
  setReducedMotion(false);
  const stamps = vi.fn();
  const context = {
    clearRect: vi.fn(),
    drawImage: stamps,
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    fillRect: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as never);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1000);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(600);
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  const cancel = vi.fn();
  vi.stubGlobal("cancelAnimationFrame", cancel);

  const { unmount } = render(<Embers />);
  frames[0](16);

  expect(stamps).toHaveBeenCalledTimes(emberCount(1000));
  expect(frames).toHaveLength(2); // the next frame was asked for

  unmount();
  expect(cancel).toHaveBeenCalled();
});
