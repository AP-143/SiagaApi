# 03: Hotspot ingestion end-to-end

**What to build:** Every 30 minutes the system pulls VIIRS detections from NASA FIRMS, keeps only those inside the Monitored Region, tags each with its Province and Regency, stores them without duplicates, and the map shows the last 24 hours of Hotspots as points. Tapping a point shows a basic popup. This is the core tracer bullet from FIRMS to the screen. See `spec.md`.

**Blocked by:** 02: Province and Regency boundaries

**Status:** ready-for-agent

- [x] The job queries the three VIIRS near-real-time sources (S-NPP, NOAA-20, NOAA-21) with a bounding box around Kalimantan and a 1-2 day lookback, using the `MAP_KEY` from server configuration
- [x] The VIIRS confidence encoding is checked against a real FIRMS sample and normalized to low, nominal, or high; the verified encoding is recorded in the docs
- [x] Hotspots whose point lies outside every Province polygon (including offshore) are discarded, with no buffer
- [x] Each kept Hotspot stores its raw coordinates, satellite, acquisition time, Confidence, Province, and Regency
- [x] A Hotspot is unique by satellite, latitude, longitude, and acquisition date and time; re-running over overlapping data creates no duplicates
- [x] The same location seen by two satellites yields two Hotspots
- [x] The job runs on a 30-minute schedule without manual intervention
- [x] The public API lists Hotspots from the last 24 hours
- [x] The map draws those Hotspots as points, and tapping one shows a popup with detection time (local Indonesian time zone), satellite, Confidence, and Regency
- [x] Seam 1 tests (fake FIRMS server, real PostGIS) cover: in-region tagging, out-of-region and offshore discard, deduplication on re-run, and two-satellite handling
- [x] The `MAP_KEY` is never written to the repository, logs, or any API response
