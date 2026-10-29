# Editorial redesign (SiagaApi feature 3)

Status: ready-for-agent

## Problem Statement

SiagaApi opens straight into a dense map with floating cards. That is right for a Responder in the field, but it gives the public and first-time visitors no entry point: no explanation of what a Hotspot is, where the data comes from, or why it matters, and the interface looks like a generic dashboard (Barlow, slate-blue cards). The project owner wants the product to feel like a quiet nature magazine, and has a reference prompt for a scrolling editorial page (cream paper, Didone capitals, rust labels, slow letter-by-letter motion) that was written for a fictional safari brand.

## Solution

Add a **Landing**: a light-only, scrolling editorial page at `/` with three full-viewport sections (hero, statement, quick facts) adapted from the reference prompt to SiagaApi's subject. A "Buka peta" link leads to the existing map, which moves to `/peta`. Old shared links such as `/?province=...` keep opening the map. The map keeps its layout but is restyled with the same paper-and-ink identity in a light and a dark theme, with gentle panel motion. Everything is built in React with the `motion` library. The decisions below were settled in a grilling session on 2026-10-29.

## User Stories

1. As a member of the public, I want a landing page that explains what a Hotspot is and where the data comes from, so that I understand the map before I use it.
2. As a member of the public, I want a clear "Buka peta" action in the hero and in the nav, so that I can reach the map at once.
3. As a Responder, I want a link I was sent earlier (`/?province=...&basemap=...`) to still open the map with those filters, so that no shared link breaks.
4. As a Responder, I want `/peta` to open the map directly, so that I can bookmark the working tool.
5. As a visitor, I want the hero title to rise in letter by letter behind a foreground silhouette, and the hero to melt into the paper as I scroll, so that the page feels crafted.
6. As a visitor, I want the statement and the quick facts to reveal when I scroll to them, so that the page reads as a calm sequence.
7. As a visitor with `prefers-reduced-motion`, I want every section shown in its final state with no animation, so that nothing makes me ill.
8. As a screen-reader user, I want split-letter headings read as normal words, so that the page makes sense aloud.
9. As a phone user, I want the landing to work at phone width without sideways scroll and without janky blur, so that it is smooth on a cheap device.
10. As a Responder, I want the map restyled with the paper-and-ink identity in light and dark, so that the product feels like one thing.
11. As a Responder, I want orange and purple to stay reserved for Hotspots and Peatland on the map, so that the interface never competes with the data.
12. As a Responder, I want text to stay readable on a phone in the field, so that decorative type never costs legibility.
13. As a Responder, I want panels to open and close with a short, quiet motion, so that the interface feels alive without slowing me down.
14. As a visitor, I want every number on the landing to be a stated fact about the data pipeline, not a live count, so that the page never shows a figure that code did not compute.
15. As the operator, I want the landing to load without MapLibre, so that the first visit is light.
16. As a developer, I want the map component to keep its current tests with only the expected visual-neutral changes, so that the redesign does not hide regressions.

## Implementation Decisions

- **Scope**: the frontend only. The backend, the API and the chat are unchanged.
- **Stack**: React 18 and the `motion` package (`motion/react`) that is already installed. No new runtime dependency unless a ticket justifies it. The reference prompt's "no framework, vanilla JS" rule and its recorder mode (`?rec=1`) are dropped.
- **Routing**: no router library. A small `Root` component decides by `location.pathname` and `location.search`:
  - `/peta` shows the map.
  - `/` with a non-empty query string shows the map (old shared links).
  - `/` with no query shows the Landing.
  - Any other path shows the Landing.
  - The map is code-split (`React.lazy`) so the Landing does not load MapLibre. The existing `App` stays the map component and keeps its tests; routing lives in `Root`.
  - Production needs a single-page fallback so `/peta` works on reload. That belongs to the hosting work, which is out of scope; the Vite dev server already falls back.
- **Landing content** (Indonesian, copy fixed in the tickets, facts taken from `docs/data-sources.md` and `GLOSSARY.md`):
  - Hero: eyebrow "HOTSPOT KALIMANTAN", display title "TITIK API", a pill "LIHAT DI PETA" to `/peta`.
  - Statement: three display lines with two inline round pills, label "SATELIT DAN BUMI". It makes no claim about frequency.
  - Quick facts: title "FAKTA / SINGKAT / TENTANG / TITIK API", a short paragraph that a Hotspot is a signal of possible fire and not proof, and a table (source, area, update interval, Confidence).
  - No live numbers anywhere on the Landing (ADR 0001).
- **Landing navigation**: wordmark on the left, "SiagaApi" over "PEMANTAU TITIK API KALIMANTAN" in the centre, "BUKA PETA →" on the right. No menu, no search.
- **Imagery** (changed after the grilling, at the owner's request): real photographs under `frontend/public/landing/`, all from Wikimedia Commons with licences checked and credited under the Landing (`credits.ts`): the hero is a dawn over a peat swamp in Borneo (CC BY 4.0); the two round pills are a NASA MODIS view of Borneo's smoke (public domain) and a night forest fire in Sukadana, Ketapang, West Kalimantan (CC0); the tall portrait is peat swamp forest in Kalimantan (CC BY 2.0). Every slot is an `ImageSlot` configured in `images.ts`, so a photo can be swapped without touching a section. No CDN hotlinks. The foreground silhouette that was meant to overlap the title was tried in SVG and dropped, because a drawn shape over a real photograph looked pasted on; a real cut-out of a photographed subject can bring it back later.
- **Logo** (also changed at the owner's request): a double ring around a single line-drawn flame, in the current text colour, with the wordmark "SiagaApi" in Bodoni Moda. It replaces the pixel-flame logo in the favicon, the Landing nav and the map header.
- **Map follows the Landing's look** (changed after review, replaces the earlier "no rust in the map" rule): the map's light theme uses the reference palette exactly (paper `#ECE3D1`, darker paper `#E6DCC8`, ink, ink at 72%, hairlines at 16%); the wordmark rises in letter by letter when the map opens; panel titles are uppercase Bodoni; field labels and the summary heading are small rust caps (Inter 600, 10.5px, tracking .2em) in a slightly deeper rust (`#8c4f2c`, 5:1) because the reference rust is only 3.3:1 on paper; the brand is two lines (wordmark over a small caps line); the summary rows fade in one by one; the same film grain covers the map page; in the light theme the basemap is washed towards cream. Rust is still never used for data marks (Hotspots, peat).
- **Map UX pass** (after a UI/UX Pro Max audit, at the owner's request for a more minimal map): the logo and name lead back to the Landing; on wide screens the chat is a separate round icon button (its name "Tanya" stays for screen readers and as a tooltip) apart from the Ringkasan bar; Escape or a press outside closes the open popover and Escape puts focus back on its button; panel buttons carry `aria-controls`; the legend starts as just its title; the status and credit boxes are smaller. Phones and medium screens keep the stacked panels.
- **Map framing and phones** (follow-up): the map is framed on Kalimantan again once it has loaded (with room for the bars), a button puts it back there, and on phones the layout is a slim name bar on top plus a bottom bar of four icons with small labels (Filter, Lapisan, Ringkasan, Tanya); a panel opens as a sheet above that bar, one at a time. The brand tagline stays on one line. At the bottom the legend and the data sources are two small chips on one row above the bar (the sources fold behind a "Sumber data" button; the map's own attribution folds to its (i)), and each steps aside while the other or a sheet is open.
- **The map is dark only** (decided later, replacing "light and dark"): there is no light theme and no theme switch; the page is always the deep brown-plum "night ink" with paper-coloured text, and the basemap is always the inverted dark one. The Landing stays paper. The top-left of the map is four separate pieces: the name, then Filter and Lapisan as one segmented pair; the top right holds Ringkasan and the round chat button. Right-hand popovers hang from the end of the right bar.
- **One bar layout at every width** (decided after the owner preferred the phone layout): a name card top left, a bar of five icon cells (icon over a small label: Filter, Lapisan, Ringkasan, Keterangan, Tanya) along the bottom, and a panel that opens as a sheet above that bar, one at a time and all closed to begin with. On a phone the bars run the full width along the bottom; on the website (wider than 640px) the five cells are a vertical rail on the left edge, just under the "Terakhir diperbarui" status pills (their height is measured, so the rail follows when a note or warning is added), and a panel opens as a sheet beside it, with the data sources as one round info button at the bottom right (the legend is now the Keterangan cell of the bar, and the map's own attribution button is off). Zoom in, zoom out and show-all are one group of three identical buttons drawn by us (MapLibre's own zoom control is not used), so they are always the same size and distance apart. This replaces the earlier wide-screen top bar with popovers.
- **"Tampilkan di peta"** (follow-up): it is its own solid paper button with a pin, not a chip; pressing it sets the filters, closes the sheet, and moves the map to where the answer's Hotspots are (or frames Kalimantan if there are none), leaving room for the bars; a refresh of the same Hotspots never moves the map. The chat also understands a preposition typed stuck to a place ("dikalimantan utara").
- **Type and colour**:
  - Fonts: Bodoni Moda (variable, weight 500, optical size pinned to 11) for display; Inter for body and labels. Barlow is removed everywhere.
  - Landing palette from the reference: paper `#ECE3D1`, darker paper `#E6DCC8`, ink `#43282A`, body text ink at 72%, rust `#A86438`, hairlines ink at 16%, plus the fixed multiply grain layer at 38%.
  - The Landing is light-only and ignores the stored theme. The scripts and `theme-color` metas in `index.html` stay correct for the map.
  - Map: new light palette derived from paper and ink, and a dark palette ("night ink", deep brown-plum). Rust is not used in the map chrome. Ember and peat keep their data meaning. Bodoni appears in the map only for big display text (wordmark, panel titles, summary numbers); Inter is used for everything small.
- **Map layout**: unchanged. Only colour, type, radius, borders and motion change.
- **Motion**: reveals follow the reference prompt (letter rise with tilt, pill spring with photo zoom from 1.5, emblem turn-in, table rows stagger, portrait clip-path wipe, parallax, ticking badge, hero melt on scroll). Built with `motion/react` (`useScroll`, `useTransform`, `whileInView`, variants, springs). Animate transform and opacity, and `filter`/`clip-path` only where the reference needs them.
- **Accessibility**: `prefers-reduced-motion` shows final states with no animation and no blur. Split-letter headings use an `aria-label` on the wrapper and `aria-hidden` letters. Touch targets are at least 44px on the map's controls. Focus rings stay visible. Contrast stays at least 4.5:1 for text.
- **Phone (at most 760px)**: nav shows icons or the short link only; hero title at 15.6vw and top 17%; statement at 8.6vw; facts stack in one column with the title at 12vw and a full-width portrait; no horizontal scroll; the scroll blur is replaced by an opacity fade.
- **Glossary**: add **Landing** to `GLOSSARY.md` (English).
- **Branch**: `feat/editorial-redesign`, from `feat/motion-ai-kit`.
- **Skills**: the `motion` skill and `motion-reviewer` write and audit the animation; UI/UX Pro Max and the web-interface guidelines audit the restyled map. If a skill disagrees with the reference prompt, the prompt wins, except on accessibility, where the skill wins.

## Testing Decisions

- **Good tests** assert what a visitor can see or do: the text on screen, the links and where they go, which view opens for a URL, reduced-motion behaviour. They do not assert animation timings or class names.
- **Seam 1: routing.** `Root` with a URL: `/` shows the Landing, `/peta` shows the map, `/?province=ID62` shows the map, an unknown path shows the Landing, and the Landing does not import MapLibre.
- **Seam 2: Landing sections.** Each section renders its Indonesian copy; the heading reads as one name for assistive technology; "BUKA PETA" and "LIHAT DI PETA" link to `/peta`; with reduced motion on, every section's content is present immediately; at a phone-width viewport nothing overflows (follow the approach in `Mobile.test.tsx`).
- **Seam 3: map restyle.** The existing map tests (`App`, `Chat`, `Filters`, `Layers`, `Theme`, `Mobile` and the rest) keep passing. Theme tests still cover light and dark. A test checks that a stored theme does not affect the Landing.
- **Manual**: a browser pass at 1440x960 and at phone width against the reference prompt's acceptance check; the `motion-reviewer` audit; a contrast and touch-target pass with UI/UX Pro Max.
- **Prior art**: `frontend/src/Theme.test.tsx`, `Mobile.test.tsx`, `App.test.tsx`, `src/test/mockApi.ts`, `src/test/fakeMapLibre.ts`.

## Out of Scope

- Background-removed cut-outs, your own photography, and any image hosted outside the repo.
- Live statistics on the Landing.
- Any new page beyond the Landing and the map, a menu, a search, and a multi-page router.
- A new layout for the map panels.
- Recorder mode and any video production tooling.
- Hosting, the single-page fallback in production, and caching headers.
- Translating to other languages.

## Further Notes

- Photographs are credited in the Landing footer, as their Creative Commons licences require.
- The reference prompt describes a fictional safari brand; none of its names, copy or elephant media are used. The look and the motion choreography are what is borrowed.
- Bodoni Moda is loaded from Google Fonts like Barlow was; self-hosting the fonts is part of the hosting work.
- The body has `height: 100%` and the map fills the viewport. The Landing scrolls normally, so the global rules must not leak between the two views (ticket 01).
- A hotspot is a satellite signal, not a confirmed fire (GLOSSARY). The Landing's copy must never call a Hotspot a confirmed fire.
