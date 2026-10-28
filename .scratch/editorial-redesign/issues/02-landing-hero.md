# 02: Landing hero

**What to build:** A visitor opening `/` sees a full-viewport hero: a smoky dawn illustration, the title "TITIK API" rising in letter by letter behind a foreground silhouette, a nav, and a "LIHAT DI PETA" pill. Scrolling melts the hero into the paper. See `spec.md` and the reference prompt's section "1 · Hero".

**Blocked by:** 01: Foundation: routing, fonts, tokens and reveal primitives

**Status:** ready-for-agent

- [x] The stage keeps the 2688:1520 ratio, covers the viewport (`width: max(100vw, 100svh * 1.7684)`), is centred, and has `container-type: inline-size`; its layers are the photograph and the title block (a foreground that overlaps the letters was tried and dropped, see Comments)
- [x] The title block sits at the top 19.2% of the stage: eyebrow "HOTSPOT KALIMANTAN" in the label style (0.66cqw) and "TITIK API" at 9.6cqw, line height .8, tracking .01em, uppercase Bodoni
- [x] The nav shows the wordmark on the left, "SiagaApi" over "PEMANTAU TITIK API KALIMANTAN" in the centre, and "BUKA PETA →" on the right, which links to `/peta`
- [x] The bottom pill "LIHAT DI PETA" has a round pin icon and an arrow, and links to `/peta`
- [x] The image layers are components that can later point at a WebP in `frontend/public/landing/` without changing the section
- [x] Load sequence: the illustration settles from scale 1.06 to 1 over 2.2s; the eyebrow and nav fade down into place; the letters of the title rise .18em out of a 10px blur, 95ms apart, left to right; the pill rises in last at about 1.05s
- [x] Scroll: the stage drifts down at .32x the scroll; a paper gradient at the bottom grows from 34% to 100% of the hero height and reaches full opacity by about 60% of a viewport scrolled; the illustration and silhouette blur up to 6px; the pill sits under the gradient and disappears with the illustration
- [x] With reduced motion, the hero shows its final state with no load animation and no scroll blur
- [x] At 760px and below the nav shows the short link only, the title sits at top 17% and 15.6vw, and the scroll blur is replaced by an opacity fade; nothing scrolls sideways
- [x] Seam 2 tests cover: the heading reads as "Titik api" to assistive technology, both links go to `/peta`, reduced motion shows everything at once, and the copy never calls a Hotspot a confirmed fire

## Comments

- Changed after review: the hero is a real photograph (see the spec) and the drawn silhouette over it was removed because it looked pasted on. A soft paper veil keeps the title readable over the clouds.

- The "copy never calls a Hotspot a confirmed fire" test needs the whole Landing's copy, so it is written once ticket 04 is done, as a test over the full Landing.
- Deviations from the reference, for legibility: the eyebrow is `max(10.5px, 0.66cqw)` and the nav tagline is 9px (the reference has 7.5px). On a phone the left logo mark is hidden and the brand moves left; "BUKA PETA" stays.
- The landing chunk is about 299 kB (99 kB gzip), most of it `motion`. Ticket 07 should check whether `LazyMotion` brings it down.
