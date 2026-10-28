/** Phones get panels that start closed, so the map is the first thing they see. */
export function isPhoneViewport(): boolean {
  return window.matchMedia?.("(max-width: 640px)").matches ?? false;
}

/** Below this width the map has no room for a legend strip along its bottom edge. */
export function isNarrowViewport(): boolean {
  return window.matchMedia?.("(max-width: 999px)").matches ?? false;
}

/**
 * Wide screens get the slim top bar: panels start closed and open one at a time as popovers under
 * their button. Keep this in step with the min-width in the "slim top bar" block of styles.css.
 */
export function isBarViewport(): boolean {
  return window.matchMedia?.("(min-width: 1000px)").matches ?? false;
}
