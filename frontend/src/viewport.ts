/** Phones get panels that start closed, so the map is the first thing they see. */
export function isPhoneViewport(): boolean {
  return window.matchMedia?.("(max-width: 640px)").matches ?? false;
}

/** Below this width the map has no room for a legend strip along its bottom edge. */
export function isNarrowViewport(): boolean {
  return window.matchMedia?.("(max-width: 999px)").matches ?? false;
}
