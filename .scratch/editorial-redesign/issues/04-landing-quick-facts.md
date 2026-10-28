# 04: Landing quick facts

**What to build:** The third Landing section: a three-column editorial block with the title, a short explanation and a facts table, and a tall illustrated portrait with parallax. A play-badge is replaced by a "BUKA PETA" badge of ticks that turns slowly. See `spec.md` and the reference prompt's section "3 · Quick facts".

**Blocked by:** 01: Foundation: routing, fonts, tokens and reveal primitives

**Status:** ready-for-agent

- [ ] A 1180px column with a hairline on top and three columns (1.12fr / 1.12fr / .96fr)
- [ ] Left column: rust label "TITIK API"; the title "FAKTA / SINGKAT / TENTANG / TITIK API" in Bodoni at `clamp(34px, 4.25vw, 66px)`, one word per line; an 84px round badge made of 48 radial ticks turning once every 16s with an arrow in the middle, linking to `/peta`; the caption "BUKA PETA"
- [ ] Middle column: a 13.4px paragraph saying a Hotspot is a satellite signal of possible fire and not proof of one, and why a Responder checks it; then a facts table with hairlines (label in ink, value in rust, right-aligned) with these rows, each taken from `docs/data-sources.md` or `GLOSSARY.md`: Sumber data (NASA FIRMS, satelit VIIRS), Wilayah (5 provinsi Kalimantan), Pembaruan (setiap 30 menit), Tingkat keyakinan (rendah, nominal, tinggi)
- [ ] No live count appears anywhere in the section
- [ ] Right column: a 2:3 portrait photograph (`images.ts` `portrait`) whose picture drifts about 7% with scroll (parallax)
- [ ] Reveal: the title letters rise like the statement's, 30ms apart; the paragraph and table rise 22px in a stagger and the rows fade in one by one; the portrait wipes up with `clip-path: inset(100% 0 0 0)` to `inset(0)` over 1.2s while its picture settles from scale 1.25
- [ ] A small credits line under the Landing lists each photograph with its author, licence and source (from `credits.ts`)
- [ ] With reduced motion, everything shows at once, the parallax is off and the badge does not turn
- [ ] At 760px and below the columns stack, the title is 12vw and the portrait is full width; nothing scrolls sideways
- [ ] Seam 2 tests cover: the four table rows and their values, the badge link going to `/peta`, no number other than the stated facts, and reduced motion
