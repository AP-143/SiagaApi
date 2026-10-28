# 07: Audit and acceptance

**What to build:** The finished redesign is checked against the reference prompt's acceptance check, for motion performance, accessibility and phone use, and any problems found are fixed. See `spec.md`.

**Blocked by:** 02: Landing hero, 03: Landing statement, 04: Landing quick facts, 06: Panel motion on the map

**Status:** ready-for-agent

- [ ] At 1440x960 the Landing behaves as the reference acceptance check says: on load the title rises in letter by letter behind the silhouette; the first scroll melts the hero into the paper and the statement climbs in with the two pills popping; the second scroll brings in the facts title, the table, the portrait wipe and the turning badge
- [ ] At phone width the Landing and the map have no sideways scroll, and the Landing's blur is replaced by a fade
- [ ] The `motion-reviewer` audit reports no high-severity finding on the Landing or the panels; any remaining finding is explained in the ticket
- [ ] A UI/UX Pro Max and web-interface-guidelines pass on the map finds no contrast, touch-target or focus failure; findings are fixed or explained
- [ ] Reduced motion is checked on every Landing section and on the panels
- [ ] No leftover English user-visible text and no leftover Barlow reference
- [ ] `npm run build` (type check and bundle) and `npm test` pass; the Landing's bundle does not include MapLibre
- [ ] The README mentions the Landing, the `/` and `/peta` addresses, and how to run both

## Comments (work so far, ticket still open)

- The `motion-reviewer` audit could not grade anything: MotionScore needs the Motion+ MCP server (paid, needs a login), which is not connected. No tier was invented. Re-run it once Motion+ is connected, or run `npx motionscore <url> --agent` against the dev server.
- Done from the web-interface-guidelines pass: images carry width and height and load lazily (the hero photo loads first), and the browser bar takes the paper colour while the Landing is open.
- Still to do from that pass: `touch-action: manipulation` on links and buttons, `translate="no"` on the "SiagaApi" wordmark, `color-scheme: light` on `.landing`, hover states for the hero pill, the nav link and the badge, a stronger focus ring on the pill over the photo, and `text-wrap: pretty` on the paragraph.
- Still to do: replace the hero's scroll-driven gradient `height` with `scaleY` (no layout each frame); try `LazyMotion` with `m` components to shrink the Landing bundle (about 304 kB, 100 kB gzip); a browser pass at 1440x960 and at phone width in dark; a pass with real basemap tiles; the README note about `/` and `/peta`.
