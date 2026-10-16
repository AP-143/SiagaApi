# 08: Data freshness and failure handling

**What to build:** Responders always see when the data was last updated, and get a clear warning when it is stale, so they never mistake missing data for no fire. If FIRMS or the ingestion job fails, the last known Hotspots stay intact and visible. See `spec.md`.

**Blocked by:** 03: Hotspot ingestion end-to-end

**Status:** ready-for-agent

- [x] The API reports the time of the last successful ingestion and a stale flag that turns on when it is older than 6 hours
- [x] The UI shows "terakhir diperbarui" with the last-updated time
- [x] The UI shows a "data may be stale" banner (in Indonesian) when the stale flag is on, while still showing the last known Hotspots
- [x] A failed or partial FIRMS response never deletes or alters stored Hotspots, and the failure is written to the logs
- [x] Seam 1 tests cover the stale flag around the 6-hour threshold and a failing FIRMS response leaving data intact and served
- [x] Seam 2 tests cover the banner appearing and disappearing based on the flag
