# 04: Region and time-window filters

**What to build:** A Responder can narrow the map by Province, Regency, and time window (24 hours by default, or 48 hours or 7 days). The chosen filters are reflected in the page address so a view can be shared with a colleague. See `spec.md`.

**Blocked by:** 03: Hotspot ingestion end-to-end

**Status:** ready-for-agent

- [x] The Hotspot API accepts Province, Regency, and time-window filters that combine
- [x] The UI has a Province selector and a Regency selector; the Regency options list only the Regencies of the chosen Province
- [x] The UI has a time-window control with 24 hours (default), 48 hours, and 7 days
- [x] The current filter state is reflected in the page address, and opening that address restores the same view
- [x] Seam 1 tests cover each filter alone and in combination
- [x] Seam 2 tests cover the dependent Regency options, the time-window control, and the address round-trip
- [x] UI text is in Indonesian
