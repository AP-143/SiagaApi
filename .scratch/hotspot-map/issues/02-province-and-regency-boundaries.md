# 02: Province and Regency boundaries

**What to build:** The five Provinces of the Monitored Region and their Regencies are available as spatial data, and the API can list them. This is the foundation for discarding out-of-region Hotspots and for the Province and Regency filters. See `spec.md`.

**Blocked by:** 01: Walking skeleton and test harness

**Status:** ready-for-agent

- [x] A boundary dataset is chosen (primary: OCHA COD-AB for Indonesia via HDX; fallback: BIG), and its license is verified as compatible with a public project
- [x] The dataset's name, year, URL, and license are recorded in a source-notes document in the repository docs
- [x] Raw files stay out of version control; a repeatable script prepares and loads them into the database
- [x] Only the five Kalimantan Provinces (Kalimantan Barat, Tengah, Selatan, Timur, Utara) and their Regencies (kabupaten and kota) are kept
- [x] The public API lists Provinces and, for a given Province, its Regencies
- [x] A Seam 1 test with fixture polygons verifies the listing and the Province-to-Regency relationship
- [x] If the download needs a login or request form, stop and ask the user to fetch the file instead of guessing
