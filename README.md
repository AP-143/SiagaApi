# SiagaApi

A public, near-real-time map of satellite-detected Hotspots across Indonesian Kalimantan, built for wildfire Responders. "Api" is Indonesian for fire; it is not an API. See `GLOSSARY.md` for the vocabulary and `.scratch/hotspot-map/spec.md` for the spec.

## Run locally

Requires Docker.

```
cp .env.example .env     # then put your FIRMS MAP_KEY in .env
docker compose up
```

- Web app: http://localhost:5173
- API: http://localhost:8000 (health check at `/health`)
- `ingestor` fetches Hotspots from NASA FIRMS every 30 minutes

### First-time data setup

The map needs the Province and Regency boundaries and the Peatland polygons before Hotspots are stored, because each Hotspot is tagged with them when it arrives. Load them once, then fetch Hotspots (see `docs/data-sources.md` for sources and licenses):

```
mkdir -p data/raw/hdx-cod-ab-idn data/raw/peat-kementan-kalimantan
docker compose run --rm api python scripts/fetch_hdx_boundaries.py /data/raw/hdx-cod-ab-idn/idn_admin1_2.geojson.zip
docker compose run --rm api python -m app.cli load-boundaries /data/raw/hdx-cod-ab-idn/idn_admin1_2.geojson.zip
docker compose run --rm api python -m app.cli fetch-peat /data/raw/peat-kementan-kalimantan/peat_kalimantan.geojson
docker compose run --rm api python -m app.cli load-peat /data/raw/peat-kementan-kalimantan/peat_kalimantan.geojson
docker compose run --rm ingestor python -m app.cli ingest      # fetch Hotspots now (only the ingestor holds the MAP_KEY)
```

If Hotspots were stored before a dataset was loaded or replaced, tag them again with `docker compose run --rm api python -m app.cli backfill`.

On Windows with Git Bash, prefix those commands with `MSYS_NO_PATHCONV=1`.

## Run the tests

Backend tests run in Docker against a real PostGIS database (Seam 1: ingestion and the read API, with a fake FIRMS server):

```
docker compose run --rm api pytest
```

Frontend tests run against a mocked API (Seam 2: user-visible UI behavior):

```
cd frontend && npm install && npm test
```

## Chat knowledge

The chat explains terms (what a Hotspot is, why peat burns) by quoting the reviewed documents in `backend/knowledge/`. Check and reload them with `docker compose run --rm api python -m app.cli load-knowledge`; see `docs/chatbot.md` for how to add one.

## Data

Raw reference datasets are not committed. See `docs/data-sources.md` for what they are, where they come from, and their licenses.
