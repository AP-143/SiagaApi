# 11: Mobile-first layout and Indonesian UI

**What to build:** Responders in the field can use the whole map comfortably on a phone browser, entirely in Indonesian, with times in a local Indonesian time zone. This is the final pass across all earlier UI work. See `spec.md`.

**Blocked by:** 04: Region and time-window filters, 05: Confidence handling, 06: Peatland and Peat Hotspots, 07: Hotspots-per-Regency panel, 08: Data freshness and failure handling

**Status:** ready-for-agent

- [x] The layout is designed phone-first: filters, the per-Regency panel, popups, and the stale banner are all usable at phone width without horizontal scrolling
- [x] All user-visible text is in Indonesian, and a review finds no leftover English strings
- [x] Detection and last-updated times appear in a local Indonesian time zone
- [x] The map opens framed on Kalimantan
- [x] Seam 2 tests cover a phone-width viewport for the main flows (filter, tap a Hotspot, read the panel)
