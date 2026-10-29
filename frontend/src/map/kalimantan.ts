export type Bounds = [[number, number], [number, number]];

// [[west, south], [east, north]] around the five Indonesian Provinces of Kalimantan.
export const KALIMANTAN_BOUNDS: Bounds = [
  [108.5, -4.3],
  [119.2, 4.5],
];

import { isPhoneViewport } from "../viewport";

/**
 * Room to leave around what the map is fitted to, so nothing ends up under a bar. On a phone: the
 * name card and status above, the icon bar below, the zoom buttons to the right. On the website: the
 * name card above and the icon rail on the left.
 */
export function framePadding() {
  return isPhoneViewport()
    ? { top: 130, bottom: 96, left: 24, right: 72 }
    : { top: 76, bottom: 44, left: 120, right: 72 };
}
