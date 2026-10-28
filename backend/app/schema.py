import psycopg

SCHEMA_SQL = """
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS provinces (
    code text PRIMARY KEY,
    name text NOT NULL,
    geom geometry(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS provinces_geom_idx ON provinces USING gist (geom);

CREATE TABLE IF NOT EXISTS regencies (
    code text PRIMARY KEY,
    name text NOT NULL,
    province_code text NOT NULL,
    geom geometry(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS regencies_geom_idx ON regencies USING gist (geom);
CREATE INDEX IF NOT EXISTS regencies_province_idx ON regencies (province_code);

-- Display copies: the real boundaries run to tens of megabytes, far too heavy to send to a browser.
-- Tagging Hotspots always uses the full-detail geometry; these are for drawing lines on the map.
ALTER TABLE provinces ADD COLUMN IF NOT EXISTS geom_simple geometry(MultiPolygon, 4326);
ALTER TABLE regencies ADD COLUMN IF NOT EXISTS geom_simple geometry(MultiPolygon, 4326);
UPDATE provinces SET geom_simple = ST_Multi(ST_CollectionExtract(
    ST_MakeValid(ST_SimplifyPreserveTopology(geom, 0.005)), 3)) WHERE geom_simple IS NULL;
UPDATE regencies SET geom_simple = ST_Multi(ST_CollectionExtract(
    ST_MakeValid(ST_SimplifyPreserveTopology(geom, 0.002)), 3)) WHERE geom_simple IS NULL;

CREATE TABLE IF NOT EXISTS hotspots (
    id bigserial PRIMARY KEY,
    satellite text NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    acquired_at timestamptz NOT NULL,
    confidence text NOT NULL CHECK (confidence IN ('low', 'nominal', 'high')),
    province_code text NOT NULL,
    regency_code text,
    geom geometry(Point, 4326) NOT NULL,
    UNIQUE (satellite, latitude, longitude, acquired_at)
);
CREATE INDEX IF NOT EXISTS hotspots_acquired_at_idx ON hotspots (acquired_at);
CREATE INDEX IF NOT EXISTS hotspots_geom_idx ON hotspots USING gist (geom);

-- A Peat Hotspot is a Hotspot whose point lies inside a Peatland polygon.
ALTER TABLE hotspots ADD COLUMN IF NOT EXISTS peat_hotspot boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS peatlands (
    id bigserial PRIMARY KEY,
    geom geometry(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS peatlands_geom_idx ON peatlands USING gist (geom);

-- Only successful runs are recorded: freshness is the time of the last one.
CREATE TABLE IF NOT EXISTS ingestion_runs (
    id bigserial PRIMARY KEY,
    succeeded_at timestamptz NOT NULL,
    fetched integer NOT NULL,
    stored integer NOT NULL
);

-- Passages of the reviewed documents the chat may quote. Rebuilt from the files in the knowledge
-- folder every time the API starts, so the files stay the single source of truth.
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id bigserial PRIMARY KEY,
    doc_file text NOT NULL,
    title text NOT NULL,
    source text NOT NULL,
    url text,
    reviewed date NOT NULL,
    heading text NOT NULL,
    body text NOT NULL,
    tsv tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('indonesian', heading), 'A') ||
        setweight(to_tsvector('indonesian', body), 'B')
    ) STORED
);
CREATE INDEX IF NOT EXISTS knowledge_chunks_tsv_idx ON knowledge_chunks USING gin (tsv);
-- The meaning of the heading as a unit-length vector (app/embeddings.py), for finding a passage by a
-- question worded with other words. A plain array is enough: the knowledge base is a few dozen
-- passages, so the comparison is done in the application and needs no vector extension. NULL means
-- the embedding model was not available when the passage was loaded.
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS heading_embedding real[];
-- A quote-only document is shown word for word and never given to a language model to reword.
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS verbatim boolean NOT NULL DEFAULT false;
"""


def ensure_schema(conn: psycopg.Connection) -> None:
    conn.execute(SCHEMA_SQL)
    conn.commit()
