# 01: Walking skeleton and test harness

**What to build:** A developer can start the whole stack locally with one command and see an empty Hotspot map of Kalimantan in the browser, backed by a running API and a spatial database. The two agreed test seams (backend end-to-end with a fake FIRMS server and real PostGIS; UI against a mocked API) exist and each has one passing example test, so every later ticket has a pattern to follow. See `spec.md` for the full context.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] One command starts the database (PostgreSQL + PostGIS), the API, and the web app locally via Docker Compose
- [x] The API exposes a health endpoint that reports it can reach the database
- [x] The web app shows a MapLibre map initially framed on Kalimantan, with no Hotspots yet
- [x] Backend test harness (Seam 1) can start a fake FIRMS HTTP server, load small fixture polygons into a real PostGIS database, and assert through the public API; one example test passes
  - Done in tickets 01-03: real PostGIS test database per test, in-process API client, fake FIRMS HTTP server (ticket 03), and fixture polygons loaded through the production boundary loader (ticket 02).
- [x] Frontend test harness (Seam 2) can render the UI against a mocked API; one example test passes
  - Done in tickets 01 and 03: UI test setup with a fake MapLibre at the WebGL boundary and a mocked API (ticket 03).
- [x] An example environment file documents the required configuration, including the FIRMS `MAP_KEY` (placeholder only, never a real key)
- [x] Version control ignores the real local environment file and the raw dataset directory
- [x] A short README explains how to start the stack and run both test suites
