/**
 * Raster paint for the basemap. Muted and inverted so Hotspot colors are what stands out: min above
 * max flips the image, so light land turns dark and dark labels turn light.
 */
export function basemapPaint() {
  return {
    "raster-saturation": -0.85,
    "raster-contrast": 0.1,
    "raster-brightness-min": 0.88,
    "raster-brightness-max": 0.12,
  };
}
