# Seed the Neon database once from the laptop

Status: resolved
Blocked by: 04

Spec: `../spec.md` (decisions 5, 6, 7)

## What to build

A command list in `docs/hosting.md` (and a small script if it helps) that fills the Neon `main` branch with the static data, run once from the owner's laptop with the **unpooled** URL: schema (including the PostGIS extension), `load-boundaries`, `fetch-peat` and `load-peat`, then `load-knowledge` with `KNOWLEDGE_EXCLUDE` naming the two health documents. Then run `ingest` once so the map is not empty (needs the server `FIRMS_MAP_KEY`). Run it.

Never print or commit `.env` or any connection string; read the URL from the environment or a file without echoing it. Before touching `main`, list what the script will do.

## Acceptance criteria

- [x] PostGIS is enabled, the five Provinces and the Peatlands are loaded, and the knowledge passages do not include the health documents.
- [x] The database size after the seed and after one ingest is written down (limit: 0.5 GB), with a rough estimate of how many months of Hotspots fit.
- [x] The commands can be repeated safely (a second run changes nothing).

## Comments

Done with `scripts/seed-remote.sh` (a pooled address is refused, the address is never printed, a dry run lists the steps) and `docs/hosting.md`. Run on Neon `main` on 2026-10-30: 5 Provinces, 56 Regencies, 146 Peatland polygons, 23 passages (no health texts), 3,527 Hotspots (927 on peat), none outside a Province. Database size 40 MB of 500 MB. The loaders are upserts or whole replacements, so a repeat changes nothing. The first Hotspot fetch used the laptop key; the server key is set in ticket 08.

Verified by running the seed a second time (without the Hotspot fetch): every count was the same as after the first run.
