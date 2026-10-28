# 05: Restyle the map in light and dark

**What to build:** A Responder opening `/peta` sees the same map and the same panels, now in the paper-and-ink identity: Inter text, Bodoni for the big display text only, and a new light and dark palette. Hotspots and Peatland keep their orange and purple. See `spec.md`.

**Blocked by:** 01: Foundation: routing, fonts, tokens and reveal primitives

**Status:** ready-for-agent

- [x] The design tokens in `styles.css` are replaced by a paper-and-ink light palette and a "night ink" dark palette (deep brown-plum); the `data-theme` mechanism, the toggle and the stored choice work as before
- [x] Rust is not used in the map chrome; `--ember` and `--peat` keep their data meaning, and the interface never uses them for decoration
- [x] Inter replaces Barlow for all small text; Bodoni Moda is used only for the wordmark, panel titles and summary numbers, never below 18px
- [x] Panel layout, structure and behaviour are unchanged; only colour, type, radius and borders change
- [x] The basemap and overlays still read well against the new colours in both themes (hotspot dots, confidence, peat and the legend keep at least 3:1 against the background; text stays at least 4.5:1)
- [x] `theme-color` metas and the pre-paint script in `index.html` match the new backgrounds
- [x] Controls that a thumb taps are at least 44px at phone width
- [x] A visible focus ring remains on every control
- [x] The existing frontend tests pass with no change in what they assert; any test edited only for a copy or a structure change that the restyle forces is listed in the pull request
- [x] A manual pass at 1440x960 and at phone width, in light and dark, is recorded in the ticket's comments

## Comments

- Manual pass at 1440 wide in light and dark, and in a 390px frame in light: no horizontal scroll, panels unchanged in layout, Bodoni only at 18px and above (wordmark, panel titles, the summary total), everything small in Inter. The basemap tiles did not load in the browser used for the pass, so Hotspot-against-basemap contrast was not looked at there; the basemap paint is unchanged. Ticket 07 repeats the pass with real tiles.
- Targets raised to 44px: the time-window segments, the chat chips, the popup close button, and MapLibre's zoom buttons on touch screens and phones.
- `--ember-strong` was darkened to `#b23a08` so orange text keeps 5:1 on the paper panel.
