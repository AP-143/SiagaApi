# 07: Hotspots-per-Regency panel

**What to build:** A side panel shows how many Hotspots each Regency has under the current filters, so Responders can see which areas are worst. Counts are labeled as Hotspots, never as fires. See `spec.md`.

**Blocked by:** 04: Region and time-window filters, 05: Confidence handling

**Status:** ready-for-agent

- [x] The API returns the number of Hotspots per Regency under the same filters as the Hotspot list
- [x] The UI panel lists Regencies with their Hotspot counts and updates when filters change
- [x] Counts use the word for Hotspot ("titik api"/"titik panas"), not "kebakaran"
- [x] Seam 1 tests verify that counts match the filtered Hotspot list for several filter combinations
- [x] Seam 2 tests verify the panel updates when a filter changes
