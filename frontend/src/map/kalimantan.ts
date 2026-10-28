export type Bounds = [[number, number], [number, number]];

// [[west, south], [east, north]] around the five Indonesian Provinces of Kalimantan.
export const KALIMANTAN_BOUNDS: Bounds = [
  [108.5, -4.3],
  [119.2, 4.5],
];

/** Room around Kalimantan when it is framed: the slim top bar above, the zoom buttons to the right. */
export const FRAME_PADDING = { top: 76, bottom: 44, left: 32, right: 72 };
