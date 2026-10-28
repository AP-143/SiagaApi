import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef, type ReactNode } from "react";

/** Where a property rests once it has arrived. */
const AT_REST: Record<string, number> = { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 };

type Props = {
  as?: "div" | "header";
  className?: string;
  children: ReactNode;
  /** What the content looks like before it arrives, for example `{ opacity: 0, y: 22 }`. */
  from: Record<string, number>;
  /** When it arrives: as soon as the page loads, or once it is scrolled to. */
  on?: "load" | "view";
  /** Arrives when true, whatever `on` says; for content timed by the section around it. */
  playing?: boolean;
  /** Seconds to wait before arriving. */
  delay?: number;
  duration?: number;
};

/** Content that settles into place from a starting look. With reduced motion it is just there. */
export default function Reveal({
  as = "div",
  className,
  children,
  from,
  on = "load",
  playing,
  delay = 0,
  duration = 0.9,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const scrolledTo = useInView(ref, { once: true, amount: 0.35 });
  const Element = as === "header" ? motion.header : motion.div;

  if (reduced) return <Element className={className}>{children}</Element>;

  const arrived = Object.fromEntries(Object.keys(from).map((key) => [key, AT_REST[key]]));
  return (
    <Element
      ref={ref as never}
      className={className}
      initial={from}
      animate={(playing ?? (on === "load" || scrolledTo)) ? arrived : from}
      transition={{ duration, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </Element>
  );
}
