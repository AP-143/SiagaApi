import { act } from "@testing-library/react";
import { vi } from "vitest";

/**
 * A matchMedia that answers the reduced-motion query and tells its listeners when the answer
 * changes, as a browser does. motion reads the preference once and then follows those changes, so a
 * test must change it through setReducedMotion rather than by stubbing matchMedia again.
 */
let reduced = false;
const listeners = new Set<() => void>();

export function installReducedMotion() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query.includes("prefers-reduced-motion") ? reduced : false;
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }));
}

export function setReducedMotion(value: boolean) {
  reduced = value;
  act(() => listeners.forEach((listener) => listener()));
}
