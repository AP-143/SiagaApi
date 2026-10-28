import type { ReactNode } from "react";

type Props = {
  /** A picture under `public/landing/` (for example "/landing/hero-sky.webp"), or null to draw. */
  src: string | null;
  /** Describes the picture; leave out when it is only decoration. */
  alt?: string;
  /** What to show while no picture is configured. */
  fallback: ReactNode;
  /** Other sizes of the same picture, so a phone does not download the largest one. */
  srcSet?: string;
  sizes?: string;
  /** The picture's size, so the page reserves its space before it loads. */
  width?: number;
  height?: number;
  /** True for the first thing on the page: load it at once and first. Otherwise it loads lazily. */
  priority?: boolean;
};

/** A place in the Landing for a picture. Today every slot shows a photograph. */
export default function ImageSlot({ src, alt = "", fallback, srcSet, sizes, width, height, priority = false }: Props) {
  if (!src) return <>{fallback}</>;
  // React 18 only passes this attribute through in lowercase.
  const hint = priority ? { fetchpriority: "high" } : {};
  return (
    <img
      className="image-slot"
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      {...hint}
    />
  );
}
