import { motion, useInView, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";

import ImageSlot from "./ImageSlot";
import { LANDING_IMAGES } from "./images";
import Reveal from "./Reveal";
import SplitText from "./SplitText";

const TITLE_LINES = ["Fakta", "singkat", "tentang", "titik api"];
const TITLE = "Fakta singkat tentang titik api";
const LETTER_GAP = 0.03;
const EASE = [0.2, 0.7, 0.2, 1] as const;
const WIPED = "inset(100% 0% 0% 0%)";
const SHOWN = "inset(0% 0% 0% 0%)";

// Every row is taken from docs/data-sources.md or GLOSSARY.md; none of them is a live number.
const FACTS = [
  ["Sumber data", "NASA FIRMS, satelit VIIRS"],
  ["Wilayah", "5 provinsi Kalimantan"],
  ["Pembaruan", "Setiap 30 menit"],
  ["Tingkat keyakinan", "Rendah, nominal, tinggi"],
] as const;

const TICKS = Array.from({ length: 48 }, (_, i) => {
  const angle = (i * 7.5 * Math.PI) / 180;
  const at = (radius: number) => [42 + Math.sin(angle) * radius, 42 - Math.cos(angle) * radius];
  const [x1, y1] = at(i % 4 === 0 ? 31 : 34);
  const [x2, y2] = at(40);
  return { x1: x1.toFixed(2), y1: y1.toFixed(2), x2: x2.toFixed(2), y2: y2.toFixed(2) };
});

/** A ring of 48 ticks that turns once every 16 seconds, with an arrow to the map in the middle. */
function Badge() {
  return (
    <a className="facts-badge" href="/peta">
      <span className="facts-badge-dial" aria-hidden="true">
        <svg className="facts-badge-ticks" viewBox="0 0 84 84" width="84" height="84" focusable="false">
          {TICKS.map((tick, i) => (
            <line key={i} {...tick} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          ))}
        </svg>
        <svg className="facts-badge-arrow" viewBox="0 0 24 24" width="22" height="22" focusable="false">
          <path
            d="M5 12h14m-5-5 5 5-5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="landing-label facts-badge-caption">Buka peta</span>
    </a>
  );
}

export default function QuickFacts() {
  const ref = useRef<HTMLElement>(null);
  const portraitRef = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const playing = useInView(ref, { once: true, amount: 0.35 });

  // The photograph drifts about 7% either way as the portrait crosses the screen.
  const { scrollYProgress } = useScroll({ target: portraitRef, offset: ["start end", "end start"] });
  const drift = useTransform(scrollYProgress, [0, 1], ["-7%", "7%"]);

  let letters = 0;
  const title = TITLE_LINES.map((line) => {
    const delay = letters * LETTER_GAP;
    letters += line.replace(/ /g, "").length;
    return (
      <span className="facts-title-line" key={line}>
        <SplitText text={line} playing={playing} delay={delay} stagger={LETTER_GAP} />
      </span>
    );
  });

  const photograph = (
    <ImageSlot
      src={LANDING_IMAGES.portrait}
      alt="Hutan rawa gambut di Kalimantan, batang-batang pohon tinggi berdiri di air yang tenang"
      fallback={null}
    />
  );

  return (
    <section ref={ref} className="facts" aria-labelledby="facts-heading">
      <div className="facts-column">
        <div className="facts-left">
          <p className="landing-label">Titik api</p>
          <h2 id="facts-heading" className="landing-display facts-title">
            <span className="sr-only">{TITLE}</span>
            <span aria-hidden="true">{title}</span>
          </h2>
          <Badge />
        </div>

        <div className="facts-middle">
          <Reveal from={{ opacity: 0, y: 22 }} playing={playing} delay={0.35}>
            <p className="facts-copy">
              Titik api adalah sinyal satelit tentang panas yang tidak biasa di satu tempat dan
              waktu. Ia tanda kemungkinan kebakaran, bukan bukti bahwa api benar-benar menyala.
              Karena itu petugas di lapangan memeriksanya dulu, dengan melihat tingkat keyakinan
              satelit dan apakah titik itu berada di lahan gambut, yang paling sulit dipadamkan.
            </p>
          </Reveal>
          <Reveal from={{ opacity: 0, y: 22 }} playing={playing} delay={0.5}>
            <table className="facts-table">
              <tbody>
                {FACTS.map(([label, value], i) => (
                  <motion.tr
                    key={label}
                    initial={reduced ? false : { opacity: 0 }}
                    animate={{ opacity: playing || reduced ? 1 : 0 }}
                    transition={{ duration: 0.6, ease: EASE, delay: 0.7 + i * 0.12 }}
                  >
                    <th scope="row">{label}</th>
                    <td>{value}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>

        {/* The portrait wipes up from the bottom while its photograph settles from a zoom. */}
        <motion.figure
          ref={portraitRef as never}
          className="facts-portrait"
          initial={reduced ? false : { clipPath: WIPED }}
          animate={reduced ? undefined : { clipPath: playing ? SHOWN : WIPED }}
          transition={{ duration: 1.2, ease: EASE, delay: 0.3 }}
        >
          <motion.div className="facts-portrait-drift" style={{ y: reduced ? 0 : drift }}>
            {reduced ? (
              photograph
            ) : (
              <motion.div
                className="facts-portrait-settle"
                initial={{ scale: 1.25 }}
                animate={{ scale: playing ? 1 : 1.25 }}
                transition={{ duration: 1.4, ease: EASE, delay: 0.3 }}
              >
                {photograph}
              </motion.div>
            )}
          </motion.div>
        </motion.figure>
      </div>
    </section>
  );
}
