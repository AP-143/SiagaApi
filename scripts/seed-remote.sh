#!/usr/bin/env bash
# Fill a remote database (the public Neon one) with the data that does not change: provinces and regencies,
# peatlands and the reviewed documents. Run it once from your laptop, with Docker running. Safe to repeat:
# the boundaries are upserted and the peatlands and documents are replaced as a whole.
#
#   SEED_DATABASE_URL=<the UNPOOLED connection string> scripts/seed-remote.sh [--dry-run]
#   SEED_FIRMS_MAP_KEY=<key> ...   also fetches the Hotspots once, so the map is not empty
#
# The connection string is read from the environment and never printed. Use the unpooled address (no
# "-pooler" in the host name): the loaders run long transactions, which a pooler does not suit.
set -euo pipefail
cd "$(dirname "$0")/.."

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

: "${SEED_DATABASE_URL:?Set SEED_DATABASE_URL to the unpooled connection string of the database to fill}"
if [[ "$SEED_DATABASE_URL" == *-pooler* ]]; then
  echo "SEED_DATABASE_URL looks like the pooled address (it contains -pooler). Use the unpooled one." >&2
  exit 1
fi

# The two health texts have not been reviewed by anyone qualified, so the public database never gets them.
EXCLUDE="${SEED_KNOWLEDGE_EXCLUDE:-kesehatan-kemenkes.md,kesehatan-who.md}"
BOUNDARIES=/data/raw/hdx-cod-ab-idn/idn_admin1_2.geojson.zip
PEAT=/data/raw/peat-kementan-kalimantan/peat_kalimantan.geojson

cli() {
  MSYS_NO_PATHCONV=1 docker compose run --rm --no-deps \
    -e "DATABASE_URL=$SEED_DATABASE_URL" -e "KNOWLEDGE_EXCLUDE=$EXCLUDE" \
    -e "FIRMS_MAP_KEY=${SEED_FIRMS_MAP_KEY:-}" api python -m app.cli "$@"
}

echo "This will, on the database named by SEED_DATABASE_URL:"
echo "  1. load the Province and Regency boundaries from $BOUNDARIES (needs the file in data/raw)"
echo "  2. load the Peatland polygons from $PEAT (downloaded first when it is missing)"
echo "  3. load the reviewed documents, leaving out: $EXCLUDE"
if [[ -n "${SEED_FIRMS_MAP_KEY:-}" ]]; then echo "  4. fetch the Hotspots from NASA FIRMS once"; fi
if $DRY_RUN; then echo "(dry run: nothing was changed)"; exit 0; fi

if [[ ! -f "data/raw/hdx-cod-ab-idn/idn_admin1_2.geojson.zip" ]]; then
  echo "Missing data/raw/hdx-cod-ab-idn/idn_admin1_2.geojson.zip: see the README (First-time data setup)." >&2
  exit 1
fi

cli load-boundaries "$BOUNDARIES"
if [[ ! -f "data/raw/peat-kementan-kalimantan/peat_kalimantan.geojson" ]]; then
  cli fetch-peat "$PEAT"
fi
cli load-peat "$PEAT"
cli load-knowledge
if [[ -n "${SEED_FIRMS_MAP_KEY:-}" ]]; then cli ingest; fi
echo "Seed finished."
