# 03: Landing statement

**What to build:** Below the hero, a full-viewport centred statement climbs in letter by letter when scrolled to, with two round photo pills popping into the gaps and a rust emblem turning in underneath. See `spec.md` and the reference prompt's section "2 · Statement".

**Blocked by:** 01: Foundation: routing, fonts, tokens and reveal primitives

**Status:** ready-for-agent

- [ ] A rust label "SATELIT DAN BUMI" sits above three lines of uppercase Bodoni at `clamp(40px, 7.2vw, 132px)`, line height 1.06: "SATELIT ● MEMANTAU / TITIK PANAS ● DI / KALIMANTAN", where each ● is a 0.86em round photo pill sitting inline (the NASA smoke view after "SATELIT", the night forest fire after "TITIK PANAS"). The wording makes no claim about update frequency
- [ ] Below the statement is a 66px rust line emblem: the new logo mark (double ring around a flame) at 66px
- [ ] Reveal at 35% visible: every letter rises from .55em below with a 4 degree tilt, 26ms apart in reading order; the pills spring in from scale 0 with an overshoot while their picture zooms from 1.5 to 1; the emblem turns in from -90 degrees and scale .6
- [ ] The statement reads as one sentence to assistive technology; the pills are decorative and hidden from it
- [ ] The pill pictures are `ImageSlot`s configured in `images.ts` (`pillSatellite`, `pillFire`)
- [ ] With reduced motion, the section shows its final state at once
- [ ] At 760px and below the statement is 8.6vw and nothing scrolls sideways
- [ ] Seam 2 tests cover: the accessible text of the statement, the decorative pills hidden from assistive technology, and reduced motion showing the final state
