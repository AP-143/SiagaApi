import { act } from "@testing-library/react";

/**
 * jsdom has no IntersectionObserver. This stand-in never reports anything by itself; a test calls
 * scrollTo(element) to say "the visitor has scrolled this far into view".
 */
const watched = new Map<Element, Set<FakeIntersectionObserver>>();

class FakeIntersectionObserver {
  constructor(private callback: IntersectionObserverCallback) {}

  observe(element: Element) {
    const observers = watched.get(element) ?? new Set();
    observers.add(this);
    watched.set(element, observers);
  }

  unobserve(element: Element) {
    watched.get(element)?.delete(this);
  }

  disconnect() {
    for (const observers of watched.values()) observers.delete(this);
  }

  takeRecords() {
    return [];
  }

  report(element: Element) {
    const entry = {
      target: element,
      isIntersecting: true,
      intersectionRatio: 1,
    } as IntersectionObserverEntry;
    this.callback([entry], this as unknown as IntersectionObserver);
  }
}

export function installFakeIntersectionObserver() {
  watched.clear();
  Object.defineProperty(window, "IntersectionObserver", {
    configurable: true,
    writable: true,
    value: FakeIntersectionObserver,
  });
}

/** Report an element as fully scrolled into view. */
export function scrollTo(element: Element) {
  act(() => {
    for (const observer of watched.get(element) ?? []) observer.report(element);
  });
}
