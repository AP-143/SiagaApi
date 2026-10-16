# Hotspot Map (SiagaApi feature 1)

Status: ready-for-agent

## Problem Statement

Wildfire Responders in Kalimantan (BPBD, Manggala Agni, local government) need to see where satellite-detected Hotspots are right now, but the raw NASA FIRMS data is a CSV feed with no map, no administrative context, and no indication of whether a Hotspot sits on Peatland, which is the most dangerous and hardest-to-extinguish terrain. Responders have to download, filter, and overlay it themselves, and on a phone in the field that is not realistic. They also cannot tell whether the data they are looking at is fresh or silently stale.

## Solution

A public, login-free, mobile-first web map of Hotspots across the Monitored Region (the five Indonesian Provinces of Kalimantan). A background ingestion job pulls VIIRS detections from NASA FIRMS every 30 minutes, drops anything outside the Monitored Region, tags each Hotspot with its Province, Regency, and whether it is a Peat Hotspot, and stores everything permanently. The map reads from that store and lets Responders filter by Province, Regency, time window, Confidence, and Peat Hotspot only. It always shows when the data was last updated and warns when the data is stale. The UI is in Indonesian; the data model and code use the canonical term `Hotspot` (the UI may say "titik api").

## User Stories

1. As a Responder, I want to open the map without logging in, so that I can see current Hotspots immediately in an emergency.
2. As a Responder, I want the map to load well on my phone's browser, so that I can use it in the field.
3. As a Responder, I want the UI in Indonesian, so that I and my colleagues can read it quickly.
4. As a Responder, I want to see Hotspots from the last 24 hours by default, so that I focus on what is current.
5. As a Responder, I want to switch the time window to 48 hours or 7 days, so that I can see how a situation developed.
6. As a Responder, I want Peat Hotspots drawn in a distinct color, so that I can spot the most dangerous ones at a glance.
7. As a Responder, I want a toggle to show only Peat Hotspots, so that I can prioritize peat fires.
8. As a Responder, I want to filter by Province, so that I can focus on my area of responsibility.
9. As a Responder, I want to filter by Regency, so that I can narrow down to my district or city.
10. As a Responder, I want the Regency filter to list only the Regencies of the chosen Province, so that I am not scrolling through irrelevant names.
11. As a Responder, I want low-Confidence Hotspots hidden by default, so that likely false positives do not distract me.
12. As a Responder, I want to turn low-Confidence Hotspots back on, so that I can see everything when I need to be thorough.
13. As a Responder, I want Confidence to affect how a Hotspot looks (size or opacity), so that I can judge reliability visually.
14. As a Responder, I want to tap a Hotspot and see a popup with its detection time, satellite, Confidence, Regency, and whether it is on Peatland, so that I can decide what to do about it.
15. As a Responder, I want detection times shown in a local Indonesian time zone, so that I do not have to convert from UTC.
16. As a Responder, I want a side panel listing the number of Hotspots per Regency for the current filters, so that I can see which areas are worst.
17. As a Responder, I want the counts labeled as Hotspots rather than fires, so that I do not mistake detections for confirmed fires.
18. As a Responder, I want to see when the data was last updated, so that I know how current the map is.
19. As a Responder, I want a clear "data may be stale" banner when the newest ingestion is older than 6 hours, so that I do not mistake missing data for the absence of fire.
20. As a Responder, I want the map to keep showing the last known Hotspots when the data feed fails, so that I still have something to work with.
21. As a Responder, I want the map to start focused on Kalimantan, so that I do not have to pan and zoom from a world view.
22. As a Responder, I want Hotspot filters to combine (for example Province, Peat Hotspots only, 48 hours), so that I can answer specific questions.
23. As a Responder, I want the filters I choose to be reflected in the page address, so that I can share a specific view with a colleague.
24. As a member of the public, I want to view the same map without an account, so that I can understand the situation near me.
25. As a researcher or developer, I want a public read-only API for Hotspots with the same filters, so that I can reuse the data.
26. As the operator, I want ingestion to run every 30 minutes without intervention, so that the map stays near-real-time.
27. As the operator, I want overlapping fetches not to create duplicate Hotspots, so that counts stay correct.
28. As the operator, I want Hotspots outside the five Provinces discarded at ingest, so that the data reflects only the Monitored Region.
29. As the operator, I want every Hotspot stored permanently with its raw coordinates, so that the history can feed future prediction work and be reprocessed.
30. As the operator, I want a backfill script that recomputes Regency and Peat Hotspot flags from raw coordinates, so that I can safely replace the Peatland or boundary datasets.
31. As the operator, I want the FIRMS `MAP_KEY` kept in server configuration only and never exposed to browsers, so that it cannot be abused.
32. As the operator, I want the public API rate limited, so that it cannot be overwhelmed.
33. As the operator, I want write operations available only to the internal ingestion job, so that the public cannot alter data.
34. As the operator, I want a failed ingestion run to leave existing data untouched and be visible in logs, so that I can diagnose problems.
35. As the operator, I want the source, year, URL, and license of each dataset recorded in the docs, so that data provenance is clear.
36. As a developer, I want the whole stack to start locally with one command, so that I can work without any hosting.
37. As a developer, I want ingestion tests to use a fake FIRMS server, so that tests need no network or `MAP_KEY`.
38. As a developer, I want raw datasets kept out of version control with a script to prepare them, so that the repository stays small and license-safe.

## Implementation Decisions

- **Scope**: only the Hotspot map. Prediction, weather layers, CSV export, and notifications are out of scope.
- **Architecture**: three parts. An ingestion job, a read-only HTTP API, and a web frontend. All use the glossary vocabulary: `Hotspot`, `Peat Hotspot`, `Peatland`, `Province`, `Regency`, `Confidence`, `Monitored Region`, `Responder`. Code uses `Hotspot`, never "fire".
- **Stack**: Python with FastAPI for the ingestion job and API; PostgreSQL with PostGIS for storage and spatial queries; React with MapLibre GL for the frontend; Docker Compose for local development. Hosting is deferred; a later deployment needs an always-on host for the ingestion job.
- **Data source**: NASA FIRMS Area API, VIIRS near-real-time sources only (S-NPP, NOAA-20, NOAA-21), queried with a bounding box around Kalimantan and a 1-2 day lookback. MODIS is excluded. The API needs a free `MAP_KEY`; a single query covers at most 5 days.
- **Ingestion**:
  - Runs every 30 minutes.
  - A Hotspot's identity is satellite + latitude + longitude + acquisition date and time. Inserts are upserts so overlapping windows never duplicate.
  - Hotspots whose point lies outside every Province polygon are discarded, including offshore detections. No buffer.
  - Each kept Hotspot is tagged at ingest with its Province, its Regency, and whether it is a Peat Hotspot (center point inside a Peatland polygon, binary, no buffer, no depth or type).
  - Raw coordinates and the satellite's Confidence value are always stored. All Confidence levels are stored.
  - Satellites are not deduplicated against each other: two satellites seeing the same fire yield two Hotspots. Counts in the UI are labeled as Hotspots.
  - A failed run must not delete or alter stored data and must be logged.
  - The VIIRS confidence encoding (believed to be `l`/`n`/`h`) is unverified and must be confirmed against a real FIRMS sample, then normalized to low, nominal, high.
- **Retention**: Hotspots are kept forever; no automatic deletion.
- **Reference datasets**:
  - Peatland: Indonesian Peatland Map 1:50,000 (Ministry of Agriculture, BBSDLP, December 2019). Fallback: WRI Global Peatlands.
  - Province and Regency boundaries: OCHA COD-AB for Indonesia via HDX. Fallback: BIG.
  - Download location and license of both are unverified and must be checked and recorded before use. If the primary peat map cannot be obtained or its license forbids public use, use the fallback.
  - Raw dataset files live in a non-committed data directory. The repository holds only the processing scripts and a source-notes document (name, year, URL, license).
  - Boundaries reflect the dataset's year; changes such as the Nusantara Capital area are not modeled beyond what the dataset contains.
- **Backfill**: a script recomputes Province, Regency, and Peat Hotspot for all stored Hotspots from raw coordinates, used whenever a reference dataset is replaced.
- **Read API** (public, no login, rate limited, read-only):
  - List Hotspots filtered by time window (24 hours, 48 hours, 7 days), Province, Regency, minimum Confidence, and Peat Hotspot only.
  - Count of Hotspots per Regency under the same filters.
  - List of Provinces and Regencies for the filter controls.
  - Data freshness: time of the last successful ingestion and a stale flag when older than 6 hours.
  - The `MAP_KEY` never appears in any response. Writes happen only inside the ingestion job.
- **Frontend**:
  - Mobile-first web app, Indonesian only, initial view framed on Kalimantan.
  - Hotspots as points: Peat Hotspots in a distinct color; Confidence affects size or opacity; low-Confidence hidden by default.
  - Filters: Province, Regency (dependent on Province), time window (default 24 hours), Confidence toggle, "Peat Hotspots only".
  - Tap popup: detection time in a local Indonesian time zone, satellite, Confidence, Regency, Peat Hotspot yes/no.
  - Side panel: Hotspot count per Regency for the current filters.
  - "Last updated" indicator and a stale-data banner when the data is older than 6 hours; the last known Hotspots stay visible when stale.
  - Current filter state is reflected in the page address so views are shareable.

## Testing Decisions

- **Good tests** assert external behavior only: what goes in at the boundary and what comes out of the public API or the rendered UI. They do not assert on internal functions, table layout, or query structure.
- **Seam 1 (primary): backend end-to-end.** Run ingestion against a fake FIRMS HTTP server returning canned CSV, with a real PostGIS database loaded with small fixture polygons for Provinces, Regencies, and Peatland. Assert through the public read API. Cases to cover:
  - Hotspots inside a Province are stored with the correct Province, Regency, and Peat Hotspot flag.
  - Hotspots outside all Provinces (including offshore) are dropped.
  - Re-running ingestion over overlapping data creates no duplicates.
  - The same location seen by two satellites yields two Hotspots.
  - Each filter (time window, Province, Regency, Confidence, Peat only) and their combinations return the right Hotspots; low-Confidence is excluded by default.
  - Per-Regency counts match the filtered list.
  - Freshness and the stale flag behave correctly around the 6-hour threshold.
  - A failing FIRMS response leaves existing data intact and the API still serves it.
  - The backfill script updates derived fields after a fixture dataset is swapped.
  - The `MAP_KEY` never appears in API responses.
- **Seam 2 (small): UI behavior against a mocked API.** Assert user-visible behavior only: low-Confidence hidden by default and toggleable, filters change what is shown, Regency options depend on the selected Province, popup contents, the per-Regency panel, the stale banner, and filter state reflected in the page address. No pixel tests of the map.
- Deliberately not their own seams: the CSV parser, point-in-polygon logic, and database access are covered through Seam 1.
- **Prior art**: none; the repository is greenfield, so these tests set the pattern.

## Out of Scope

- AI fire prediction and any weather or climate layers.
- CSV or other data export, notifications, user accounts, and a native mobile app.
- MODIS data, and cross-sensor deduplication.
- Fire confirmation workflows (the `Fire` term is reserved but unused).
- Peat depth or type, and buffers around Peatland or Province boundaries.
- Languages other than Indonesian in the UI.
- Production hosting and deployment.
- Handling of boundary changes beyond swapping the dataset and running the backfill script.

## Further Notes

- "Api" in SiagaApi is Indonesian for fire, not an API.
- Open risks to resolve early: peat map download and license, boundary dataset license and year, and the VIIRS Confidence encoding. A FIRMS `MAP_KEY` must be obtained from NASA before any real ingestion.
- Offshore or coastline-adjacent real fires may be dropped because of coarse boundary polygons; this risk is accepted for the first version.
- FIRMS near-real-time data lags the satellite pass by roughly 3 hours, so the map is near-real-time, not real-time.
