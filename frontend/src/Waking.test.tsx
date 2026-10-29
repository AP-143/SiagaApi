import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import StatusBar, { WAKING_AFTER_MS } from "./StatusBar";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const quiet = { freshness: null, notes: [] };

test("a quick load only says the Hotspots are loading", () => {
  render(<StatusBar {...quiet} loading loadFailed={false} />);

  act(() => vi.advanceTimersByTime(WAKING_AFTER_MS - 1));

  expect(screen.getByRole("status")).toHaveTextContent("Memuat titik api");
  expect(screen.queryByText(/sedang bangun/)).toBeNull();
});

test("a slow load says the server is waking up, as a status and not as an error", () => {
  render(<StatusBar {...quiet} loading loadFailed={false} />);

  act(() => vi.advanceTimersByTime(WAKING_AFTER_MS));

  expect(screen.getByRole("status")).toHaveTextContent(/Server sedang bangun, mohon tunggu/);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("the waking message goes away when the data arrives", () => {
  const { rerender } = render(<StatusBar {...quiet} loading loadFailed={false} />);
  act(() => vi.advanceTimersByTime(WAKING_AFTER_MS));

  rerender(<StatusBar {...quiet} loading={false} loadFailed={false} />);

  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByText(/sedang bangun/)).toBeNull();
});

test("a load that failed shows the error, not the waking message", () => {
  const { rerender } = render(<StatusBar {...quiet} loading loadFailed={false} />);
  act(() => vi.advanceTimersByTime(WAKING_AFTER_MS));

  rerender(<StatusBar {...quiet} loading={false} loadFailed />);

  expect(screen.getByRole("alert")).toHaveTextContent("Tidak dapat memuat data terbaru dari server");
  expect(screen.queryByText(/sedang bangun/)).toBeNull();
});

test("a new load starts counting from zero again", () => {
  const { rerender } = render(<StatusBar {...quiet} loading loadFailed={false} />);
  act(() => vi.advanceTimersByTime(WAKING_AFTER_MS));
  rerender(<StatusBar {...quiet} loading={false} loadFailed={false} />);

  rerender(<StatusBar {...quiet} loading loadFailed={false} />);
  act(() => vi.advanceTimersByTime(WAKING_AFTER_MS - 1));

  expect(screen.getByRole("status")).toHaveTextContent("Memuat titik api");
});
