# 05: Confidence handling

**What to build:** Low-Confidence Hotspots are hidden on the map by default so likely false positives do not distract Responders, but they are all stored and can be switched on. Confidence also shapes how a point looks so reliability is visible at a glance. See `spec.md`.

**Blocked by:** 03: Hotspot ingestion end-to-end

**Status:** ready-for-agent

- [x] The Hotspot API accepts a minimum-Confidence filter; low-Confidence Hotspots are excluded by default
- [x] The UI has a toggle to include low-Confidence Hotspots
- [x] Point size or opacity reflects Confidence (low, nominal, high)
- [x] Seam 1 tests cover the default exclusion of low and the inclusion when requested
- [x] Seam 2 tests cover the default hidden state and the toggle
- [x] UI text is in Indonesian
