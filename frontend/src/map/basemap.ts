import type { Theme } from "../theme";

/** Raster paint for the basemap. Muted in both themes so Hotspot colors are what stands out. */
export function basemapPaint(theme: Theme) {
  return theme === "dark"
    ? // Min above max inverts the image: light land turns dark, dark labels turn light.
      {
        "raster-saturation": -0.85,
        "raster-contrast": 0.1,
        "raster-brightness-min": 0.88,
        "raster-brightness-max": 0.12,
      }
    : {
        "raster-saturation": -0.55,
        "raster-contrast": 0.05,
        "raster-brightness-min": 0,
        "raster-brightness-max": 1,
      };
}
