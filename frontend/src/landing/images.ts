/**
 * The pictures of the Landing, all under `public/landing/` (credits are in credits.ts). Set a slot to
 * null to fall back to its drawing, or point it at another WebP; no section needs to change.
 */
export const LANDING_IMAGES = {
  heroImage: "/landing/hero-night.webp" as string | null,
  /** The hero in two sizes; the browser picks by screen width. */
  heroImageSet: "/landing/hero-night-1600.webp 1600w, /landing/hero-night.webp 3060w" as string | undefined,
  pillSatellite: "/landing/pill-satellite.webp" as string | null,
  pillFire: "/landing/pill-fire.webp" as string | null,
  portrait: "/landing/portrait-night.webp" as string | null,
};
