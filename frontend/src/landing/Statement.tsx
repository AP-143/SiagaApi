import { motion, useInView, useReducedMotion } from "motion/react";
import { Fragment, useRef } from "react";

import LogoMark from "../LogoMark";
import ImageSlot from "./ImageSlot";
import { LANDING_IMAGES } from "./images";
import SplitText from "./SplitText";

type Piece = { text: string } | { pill: "satellite" | "fire" };

// Each line of the statement. A pill sits in the gap where a round photograph is wanted.
const LINES: Piece[][] = [
  [{ text: "Satelit" }, { pill: "satellite" }, { text: "memantau" }],
  [{ text: "titik panas" }, { pill: "fire" }, { text: "di" }],
  [{ text: "Kalimantan" }],
];

const SENTENCE = "Satelit memantau titik panas di Kalimantan";
const LETTER_GAP = 0.026;
const EASE = [0.2, 0.7, 0.2, 1] as const;

function Pill({ kind, playing, delay }: { kind: "satellite" | "fire"; playing: boolean; delay: number }) {
  const reduced = useReducedMotion();
  const src = kind === "satellite" ? LANDING_IMAGES.pillSatellite : LANDING_IMAGES.pillFire;
  if (reduced) {
    return (
      <span className="statement-pill">
        <ImageSlot src={src} fallback={null} />
      </span>
    );
  }
  return (
    // The pill springs in with an overshoot while its photograph settles from a zoom.
    <motion.span
      className="statement-pill"
      initial={{ scale: 0 }}
      animate={{ scale: playing ? 1 : 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 11, delay }}
    >
      <motion.span
        className="statement-pill-photo"
        initial={{ scale: 1.5 }}
        animate={{ scale: playing ? 1 : 1.5 }}
        transition={{ duration: 1.1, ease: EASE, delay }}
      >
        <ImageSlot src={src} fallback={null} />
      </motion.span>
    </motion.span>
  );
}

export default function Statement() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const playing = useInView(ref, { once: true, amount: 0.35 });

  // Letters and pills arrive in reading order, so each waits for everything before it.
  let letters = 0;
  const lines = LINES.map((line, l) => (
    <span className="statement-line" key={l}>
      {line.map((piece, p) => {
        const delay = letters * LETTER_GAP;
        if ("pill" in piece) {
          return (
            <Fragment key={p}>
              {p > 0 && " "}
              <Pill kind={piece.pill} playing={playing} delay={delay} />
            </Fragment>
          );
        }
        letters += piece.text.replace(/ /g, "").length;
        return (
          <Fragment key={p}>
            {p > 0 && " "}
            <SplitText text={piece.text} playing={playing} delay={delay} stagger={LETTER_GAP} />
          </Fragment>
        );
      })}
    </span>
  ));

  const emblemDelay = letters * LETTER_GAP + 0.2;

  return (
    <section ref={ref} className="statement" aria-labelledby="statement-heading">
      <p className="landing-label">Satelit dan bumi</p>
      <h2 id="statement-heading" className="landing-display statement-text">
        <span className="sr-only">{SENTENCE}</span>
        <span aria-hidden="true">{lines}</span>
      </h2>
      {reduced ? (
        <span className="statement-emblem" aria-hidden="true">
          <LogoMark size={66} />
        </span>
      ) : (
        <motion.span
          className="statement-emblem"
          aria-hidden="true"
          initial={{ rotate: -90, scale: 0.6, opacity: 0 }}
          animate={playing ? { rotate: 0, scale: 1, opacity: 1 } : { rotate: -90, scale: 0.6, opacity: 0 }}
          transition={{ duration: 1.2, ease: EASE, delay: emblemDelay }}
        >
          <LogoMark size={66} />
        </motion.span>
      )}
    </section>
  );
}
