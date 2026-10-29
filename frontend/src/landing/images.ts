/**
 * The pictures of the Landing, all under `public/landing/` (credits are in credits.ts). Set a slot to
 * null to fall back to its drawing, or point it at another WebP; no section needs to change.
 */
import { withBase } from "../base";

export type HeroSlide = {
  src: string;
  /** The same photograph in three sizes; the browser picks by screen width. */
  srcSet: string;
};

const picture = (file: string) => withBase(`/landing/${file}`);

const heroSlide = (name: string): HeroSlide => ({
  src: picture(`${name}.webp`),
  srcSet: `${picture(`${name}-1600.webp`)} 1600w, ${picture(`${name}-2560.webp`)} 2560w, ${picture(`${name}.webp`)} 3840w`,
});

export const LANDING_IMAGES = {
  /** The photographs that slide across the top of the page, in order; the first is the one it opens with. */
  heroSlides: [heroSlide("hero-night"), heroSlide("hero-ridge"), heroSlide("hero-hillside")] as readonly HeroSlide[],
  pillSatellite: picture("pill-satellite.webp") as string | null,
  pillFire: picture("pill-fire.webp") as string | null,
  portrait: picture("portrait-night.webp") as string | null,
};
