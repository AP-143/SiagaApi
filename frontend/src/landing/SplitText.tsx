import { motion, useInView, useReducedMotion } from "motion/react";
import { createElement, Fragment, useRef } from "react";

type Props = {
  text: string;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className?: string;
  /** Seconds between one letter and the next, in reading order. */
  stagger?: number;
};

const HIDDEN = { opacity: 0, y: "0.55em", rotate: 4 };
const SHOWN = { opacity: 1, y: 0, rotate: 0 };

/**
 * Text that climbs in one letter at a time when it is scrolled to. Assistive technology gets the
 * whole text from the wrapper; the single letters are hidden from it. With reduced motion the
 * letters are simply in place.
 */
export default function SplitText({ text, as = "span", className, stagger = 0.026 }: Props) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const inView = useInView(ref, { once: true, amount: 0.35 });

  let index = 0;
  const words = text.split(" ").map((word, w) => (
    <Fragment key={w}>
      {w > 0 && " "}
      {/* A word stays whole; only the gap between words may wrap. */}
      <span className="split-word">
        {Array.from(word, (letter) => {
          const delay = index++ * stagger;
          return reduced ? (
            <span key={index} aria-hidden="true" className="split-letter">
              {letter}
            </span>
          ) : (
            <motion.span
              key={index}
              aria-hidden="true"
              className="split-letter"
              initial={HIDDEN}
              animate={inView ? SHOWN : HIDDEN}
              transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1], delay }}
            >
              {letter}
            </motion.span>
          );
        })}
      </span>
    </Fragment>
  ));

  return createElement(as, { ref, className, "aria-label": text }, words);
}
