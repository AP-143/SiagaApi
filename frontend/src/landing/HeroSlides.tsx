import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import type { HeroSlide } from "./images";

/** How long a photograph stays before the next one slides in. */
export const SLIDE_INTERVAL_MS = 6500;

type Position = { current: number; previous: number | null };

/**
 * Which photograph is showing and which one it just replaced. The next one slides in on its own every
 * few seconds, unless the visitor asked for less motion or the tab is in the background; choosing one by
 * hand starts its time again.
 */
export function useHeroSlides(count: number) {
  const reduced = useReducedMotion();
  const [position, setPosition] = useState<Position>({ current: 0, previous: null });
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);

  const go = useCallback(
    (next: number) =>
      setPosition((now) => (next === now.current ? now : { current: next, previous: now.current })),
    [],
  );

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (reduced || hidden || count < 2) return;
    const timer = setTimeout(() => go((position.current + 1) % count), SLIDE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [reduced, hidden, count, position.current, go]);

  return { ...position, go, auto: !reduced && !hidden && count > 1 };
}

/** The photographs, one on top of the other; the one showing slides in over the one it replaces. */
export function HeroSlideImages({
  slides,
  current,
  previous,
}: {
  slides: readonly HeroSlide[];
  current: number;
  previous: number | null;
}) {
  return (
    <>
      {slides.map((slide, i) => (
        <div
          key={slide.src}
          className="hero-slide"
          data-state={i === current ? "current" : i === previous ? "previous" : "waiting"}
        >
          <img
            className="image-slot"
            src={slide.src}
            srcSet={slide.srcSet}
            sizes="100vw"
            width={3840}
            height={2171}
            alt=""
            // The first one is the picture the page opens with; the others are fetched at once but after it.
            loading="eager"
            decoding="async"
            {...(i === 0 ? { fetchpriority: "high" } : { fetchpriority: "low" })}
          />
        </div>
      ))}
    </>
  );
}

/** One small bar for each photograph; the one showing fills as its time runs out. */
export function HeroSlideDots({
  count,
  current,
  auto,
  go,
}: {
  count: number;
  current: number;
  auto: boolean;
  go: (index: number) => void;
}) {
  if (count < 2) return null;
  return (
    <div className="hero-dots" role="group" aria-label="Foto di bagian atas">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          className="hero-dot"
          aria-label={`Foto ${i + 1} dari ${count}`}
          aria-current={i === current ? "true" : undefined}
          onClick={() => go(i)}
        >
          <span className="hero-dot-bar">
            {i === current && (
              // Keyed by the photograph, so the bar starts from empty each time one comes in.
              <span
                key={`${current}-${auto}`}
                className="hero-dot-fill"
                data-running={auto ? "true" : "false"}
                style={{ animationDuration: `${SLIDE_INTERVAL_MS}ms` }}
              />
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
