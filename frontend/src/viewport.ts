/** Phones get panels that start closed, so the map is the first thing they see. */
export function isPhoneViewport(): boolean {
  return window.matchMedia?.("(max-width: 640px)").matches ?? false;
}

/** Below this width the map has no room for a legend strip along its bottom edge. */
export function isNarrowViewport(): boolean {
  return window.matchMedia?.("(max-width: 999px)").matches ?? false;
}

/**
 * Every real browser gets the bar layout: a name bar on top, a bar of four icons at the bottom, and
 * panels that open one at a time as sheets above it, all closed to begin with. The query is true at
 * any width; a test environment with no matchMedia keeps the stacked layout the older tests describe.
 */
export function isBarViewport(): boolean {
  return window.matchMedia?.("(min-width: 1px)").matches ?? false;
}
