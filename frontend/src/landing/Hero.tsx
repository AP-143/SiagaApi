import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useEffect, useState } from "react";

import LogoMark from "../LogoMark";
import { HeroForeground, HeroSky } from "./HeroArt";
import ImageSlot from "./ImageSlot";
import { LANDING_IMAGES } from "./images";
import Reveal from "./Reveal";
import SplitText from "./SplitText";

const PHONE = "(max-width: 760px)";

function useIsPhone() {
  const [phone, setPhone] = useState(() => window.matchMedia?.(PHONE).matches ?? false);
  useEffect(() => {
    const query = window.matchMedia?.(PHONE);
    if (!query) return;
    const update = () => setPhone(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return phone;
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 1 1 13 0C18.5 15.4 12 21 12 21Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10.5" r="2.3" fill="currentColor" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M5 12h14m-5-5 5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** How far the hero has melted into the paper: 0 at rest, 1 once 60% of a screen is scrolled. */
const clamp = (value: number) => Math.min(1, Math.max(0, value));

export default function Hero() {
  const reduced = useReducedMotion();
  const phone = useIsPhone();
  const { scrollY } = useScroll();
  const melt = useTransform(scrollY, (y) => clamp(y / (0.6 * window.innerHeight)));

  // The stage drifts down at a third of the scroll, so the photograph lags behind the page.
  const drift = useTransform(scrollY, (y) => (reduced ? 0 : y * 0.32));
  const meltHeight = useTransform(melt, (p) => `${34 + 66 * p}%`);
  const pillOpacity = useTransform(melt, (p) => 1 - p);
  // Blur is costly on a phone, so there the layers only fade.
  const blur = useTransform(melt, (p) => (reduced || phone ? "none" : `blur(${p * 6}px)`));
  const fade = useTransform(melt, (p) => (phone && !reduced ? 1 - 0.6 * p : 1));

  // The drawing settles from slightly enlarged, like a photograph coming into focus.
  const settle = reduced
    ? {}
    : { initial: { scale: 1.06 }, animate: { scale: 1 }, transition: { duration: 2.2, ease: [0.2, 0.7, 0.2, 1] as const } };

  return (
    <section className="hero">
      <div className="hero-frame">
        <motion.div className="hero-stage" style={{ y: drift }}>
          <motion.div className="hero-layer" style={{ filter: blur, opacity: fade }} {...settle}>
            <ImageSlot src={LANDING_IMAGES.heroSky} fallback={<HeroSky />} />
          </motion.div>

          <div className="hero-title">
            <Reveal from={{ opacity: 0, y: -10 }} duration={0.8} delay={0.15}>
              <p className="landing-label hero-eyebrow">Hotspot Kalimantan</p>
            </Reveal>
            <SplitText
              as="h1"
              text="Titik api"
              className="landing-display hero-heading"
              on="load"
              stagger={0.095}
              delay={0.35}
              rise={0.18}
              tilt={0}
              blur={10}
            />
          </div>

          <motion.div className="hero-layer hero-foreground" style={{ filter: blur, opacity: fade }} {...settle}>
            <ImageSlot src={LANDING_IMAGES.heroForeground} fallback={<HeroForeground />} />
          </motion.div>
        </motion.div>
      </div>

      <motion.div className="hero-pill-slot" style={{ opacity: pillOpacity }}>
        <Reveal from={{ opacity: 0, y: 18 }} delay={1.05}>
          <a className="hero-pill" href="/peta">
            <span className="hero-pill-pin">
              <PinIcon />
            </span>
            Lihat di peta
            <ArrowIcon />
          </a>
        </Reveal>
      </motion.div>

      <motion.div
        className="hero-melt"
        aria-hidden="true"
        style={{ height: meltHeight, opacity: melt }}
      />

      <Reveal as="header" className="hero-nav" from={{ opacity: 0, y: -10 }} delay={0.15}>
        <span className="hero-nav-mark">
          <LogoMark size={30} />
        </span>
        <div className="hero-nav-brand">
          <span className="landing-display hero-nav-name">SiagaApi</span>
          <span className="hero-nav-tagline">Pemantau titik api Kalimantan</span>
        </div>
        <a className="hero-nav-link" href="/peta">
          Buka peta <ArrowIcon />
        </a>
      </Reveal>
    </section>
  );
}
