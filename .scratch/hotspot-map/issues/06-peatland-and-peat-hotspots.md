# 06: Peatland and Peat Hotspots

**What to build:** Hotspots that fall on Peatland are marked as Peat Hotspots, drawn in a distinct color, shown as such in the popup, and filterable with a "Peat Hotspots only" toggle. Peat is the most dangerous and hardest-to-extinguish terrain, so Responders must spot these first. See `spec.md`.

**Blocked by:** 03: Hotspot ingestion end-to-end

**Status:** ready-for-agent

- [x] A Peatland dataset is chosen (primary: Indonesian Peatland Map 1:50,000, Ministry of Agriculture BBSDLP, December 2019; fallback: WRI Global Peatlands), and its download location is verified
  - Chosen: the Kementan 1:50,000 peat map of Kalimantan, downloaded from the BIG Satu Peta ArcGIS service (layer 6). 146 polygons, loaded and backfilled on real data. WRI was not needed (it is a raster).
- [ ] The dataset's license is verified as compatible with a public project
  - NOT DONE: no license is stated on the layer (copyright text "Sekretariat Kebijakan Satupeta", public-access tier, data.go.id listing marked "Terbuka"). A human must confirm the terms with the data owner before a public deployment. See "Peatland" in docs/data-sources.md.
- [x] The dataset's name, year, URL, and license are recorded in the source-notes document
  - The license is recorded as "unverified", which is the honest state of it.
- [x] Raw files stay out of version control; a repeatable script prepares and loads Peatland polygons into the database
- [x] A Hotspot is a Peat Hotspot when its center point lies inside a Peatland polygon: binary, no buffer, no peat depth or type
- [x] The Peat Hotspot flag is computed at ingest and stored with each Hotspot
- [x] The Hotspot API accepts a "Peat Hotspots only" filter and returns the flag for every Hotspot
- [x] The map draws Peat Hotspots in a distinct color, the popup shows whether the Hotspot is on Peatland, and the UI has a "Peat Hotspots only" toggle
- [x] Seam 1 tests with fixture polygons cover on-peat, off-peat, and the Peat-only filter
- [x] Seam 2 tests cover the distinct styling hook, the popup field, and the toggle
- [x] If the download needs a login or request form, stop and ask the user to fetch the file instead of guessing
  - Not needed in the end: the layer is downloadable without login through the BIG Satu Peta service.
