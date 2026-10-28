# 02: Landing hero

**What to build:** A visitor opening `/` sees a full-viewport hero: a smoky dawn illustration, the title "TITIK API" rising in letter by letter behind a foreground silhouette, a nav, and a "LIHAT DI PETA" pill. Scrolling melts the hero into the paper. See `spec.md` and the reference prompt's section "1 · Hero".

**Blocked by:** 01: Foundation: routing, fonts, tokens and reveal primitives

**Status:** ready-for-agent

- [ ] The stage keeps the 2688:1520 ratio, covers the viewport (`width: max(100vw, 100svh * 1.7684)`), is centred, and has `container-type: inline-size`; its layers are the sky illustration, the title block, then the foreground silhouette that overlaps the lower part of the title letters
- [ ] The title block sits at the top 19.2% of the stage: eyebrow "HOTSPOT KALIMANTAN" in the label style (0.66cqw) and "TITIK API" at 9.6cqw, line height .8, tracking .01em, uppercase Bodoni
- [ ] The nav shows the wordmark on the left, "SiagaApi" over "PEMANTAU TITIK API KALIMANTAN" in the centre, and "BUKA PETA →" on the right, which links to `/peta`
- [ ] The bottom pill "LIHAT DI PETA" has a round pin icon and an arrow, and links to `/peta`
- [ ] The image layers are components that can later point at a WebP in `frontend/public/landing/` without changing the section
- [ ] Load sequence: the illustration settles from scale 1.06 to 1 over 2.2s; the eyebrow and nav fade down into place; the letters of the title rise .18em out of a 10px blur, 95ms apart, left to right; the pill rises in last at about 1.05s
- [ ] Scroll: the stage drifts down at .32x the scroll; a paper gradient at the bottom grows from 34% to 100% of the hero height and reaches full opacity by about 60% of a viewport scrolled; the illustration and silhouette blur up to 6px; the pill sits under the gradient and disappears with the illustration
- [ ] With reduced motion, the hero shows its final state with no load animation and no scroll blur
- [ ] At 760px and below the nav shows the short link only, the title sits at top 17% and 15.6vw, and the scroll blur is replaced by an opacity fade; nothing scrolls sideways
- [ ] Seam 2 tests cover: the heading reads as "Titik api" to assistive technology, both links go to `/peta`, reduced motion shows everything at once, and the copy never calls a Hotspot a confirmed fire
