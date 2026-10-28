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
