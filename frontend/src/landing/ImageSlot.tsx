import type { ReactNode } from "react";

type Props = {
  /** A picture under `public/landing/` (for example "/landing/hero-sky.webp"), or null to draw. */
  src: string | null;
  /** Describes the picture; leave out when it is only decoration. */
  alt?: string;
  /** What to show while no picture is configured. */
  fallback: ReactNode;
};

/** A place in the Landing for a picture. Today every slot shows an SVG drawing. */
export default function ImageSlot({ src, alt = "", fallback }: Props) {
  if (!src) return <>{fallback}</>;
  return <img className="image-slot" src={src} alt={alt} />;
}
