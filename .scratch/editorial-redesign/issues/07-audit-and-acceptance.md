# 07: Audit and acceptance

**What to build:** The finished redesign is checked against the reference prompt's acceptance check, for motion performance, accessibility and phone use, and any problems found are fixed. See `spec.md`.

**Blocked by:** 02: Landing hero, 03: Landing statement, 04: Landing quick facts, 06: Panel motion on the map

**Status:** ready-for-agent (one check left: the Motion+ MotionScore audit)

- [x] At 1440x960 the Landing behaves as the reference acceptance check says: on load the title rises in letter by letter (the foreground silhouette was dropped, see ticket 02); the first scroll melts the hero into the paper and the statement climbs in with the two pills popping; the second scroll brings in the facts title, the table, the portrait wipe and the turning badge
- [x] At phone width the Landing and the map have no sideways scroll, and the Landing's blur is replaced by a fade
- [ ] The `motion-reviewer` audit reports no high-severity finding on the Landing or the panels; any remaining finding is explained in the ticket
- [x] A UI/UX Pro Max and web-interface-guidelines pass on the map finds no contrast, touch-target or focus failure; findings are fixed or explained
- [x] Reduced motion is checked on every Landing section and on the panels
- [x] No leftover English user-visible text and no leftover Barlow reference
- [x] `npm run build` (type check and bundle) and `npm test` pass; the Landing's bundle does not include MapLibre
- [x] The README mentions the Landing, the `/` and `/peta` addresses, and how to run both

## Comments

- **Not done: the `motion-reviewer` audit.** MotionScore needs the Motion+ MCP server (paid, needs a login), which was not connected, so no tier was graded or invented. Re-run it once Motion+ is connected, or run `npx motionscore <url> --agent` against the dev server. A short static read stood in for it: about 75 animated letters in all; scroll effects use motion values (no React re-render); the hero gradient now scales instead of resizing; the scroll blur is the one costly effect and is off on phones and with reduced motion; the panel height animation lasts 220ms.
- **Done later: Hotspot contrast against real tiles** (see ticket 05): white-edged dots read on the dark map and on satellite; boundary lines got a dark casing for the clouds.
- Web-interface-guidelines pass: fixed images (size, lazy loading, priority for the hero), `touch-action: manipulation`, `translate="no"` on the wordmark, `color-scheme: light` on the Landing, the browser bar colour on the Landing, hover states and a stronger focus ring on the hero controls, `text-wrap: pretty` on the paragraph. Not done on purpose: a skip link (the Landing is three sections and no navigation), preloading Google Fonts (they come from a stylesheet link).
- Bundle: `LazyMotion` with `m` components cut the Landing's JavaScript from about 100 kB to 86 kB gzip. MapLibre stays in the separate map chunk (a test checks the Landing never loads it).
- Phone pass in a 390px frame: no horizontal scroll on the Landing or on the map in light and dark; the Landing stays light when the stored theme is dark.
- Later sweep (real browser, 360/390/768 px and 740x360 landscape, dark theme): fixed a white hotspot popup with pale text, a stray "0" in chat answers without a source, status warnings that ran off the screen in one row, a Tab order that did not match the drawn order of the bar, and a Loading test that timed out on a busy machine. Not checked: a physical touch device.
