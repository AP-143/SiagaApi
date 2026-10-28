import { m, useInView, useReducedMotion } from "motion/react";
import { createElement, Fragment, useRef } from "react";

import MotionFeatures from "../MotionFeatures";

type Props = {
  text: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className?: string;
  /** When the letters play: as soon as the page loads, or once the text is scrolled to. */
  on?: "view" | "load";
  /** Plays the letters when true, whatever `on` says; for text that is timed by something around it. */
  playing?: boolean;
  /** Seconds between one letter and the next, in reading order. */
  stagger?: number;
  /** Seconds to wait before the first letter. */
  delay?: number;
  /** How far below its place a letter starts, in em. */
  rise?: number;
  /** How much a letter starts tilted, in degrees. */
  tilt?: number;
  /** How blurred a letter starts, in px. */
  blur?: number;
  /** Seconds one letter takes to settle. */
  duration?: number;
};

/**
 * Text that climbs in one letter at a time. Assistive technology gets the whole text from the
 * wrapper; the single letters are hidden from it. With reduced motion the letters are simply in
 * place. The defaults suit a statement scrolled into view.
 */
export default function SplitText({
  text,
  as = "span",
  className,
  on = "view",
  playing: playingOverride,
  stagger = 0.026,
  delay = 0,
  rise = 0.55,
  tilt = 4,
  blur = 0,
  duration = 0.9,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const scrolledTo = useInView(ref, { once: true, amount: 0.35 });
  const playing = playingOverride ?? (on === "load" || scrolledTo);

  const hidden = { opacity: 0, y: `${rise}em`, rotate: tilt, filter: `blur(${blur}px)` };
  const shown = { opacity: 1, y: 0, rotate: 0, filter: "blur(0px)" };

  let index = 0;
  const words = text.split(" ").map((word, w) => (
    <Fragment key={w}>
      {w > 0 && " "}
      {/* A word stays whole; only the gap between words may wrap. */}
      <span className="split-word">
        {Array.from(word, (letter) => {
          const wait = delay + index++ * stagger;
          return reduced ? (
            <span key={index} aria-hidden="true" className="split-letter">
              {letter}
            </span>
          ) : (
            <m.span
              key={index}
              aria-hidden="true"
              className="split-letter"
              initial={hidden}
              animate={playing ? shown : hidden}
              transition={{ duration, ease: [0.2, 0.7, 0.2, 1], delay: wait }}
            >
              {letter}
            </m.span>
          );
        })}
      </span>
    </Fragment>
  ));

  return <MotionFeatures>{createElement(as, { ref, className, "aria-label": text }, words)}</MotionFeatures>;
}
