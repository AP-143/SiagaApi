# 09: Backfill script

**What to build:** When a reference dataset (Peatland or boundaries) is replaced, an operator can run one script that recomputes Province, Regency, and Peat Hotspot for every stored Hotspot from its raw coordinates, so history stays consistent with the new data. See `spec.md`.

**Blocked by:** 06: Peatland and Peat Hotspots

**Status:** ready-for-agent

- [x] A script recomputes Province, Regency, and the Peat Hotspot flag for all stored Hotspots using the datasets currently loaded
- [x] Hotspots that no longer fall inside any Province after a dataset change are handled explicitly and the outcome is reported (not silently dropped)
- [x] The script can be re-run safely and reports how many Hotspots changed
- [x] A Seam 1 test swaps fixture polygons and verifies the derived fields update through the public API
- [x] Usage is documented in the repository docs
