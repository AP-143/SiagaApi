import json
import zipfile
from collections.abc import Iterable, Iterator
from pathlib import Path

import ijson
import psycopg

from app.schema import ensure_schema

# BPS/OCHA COD-AB codes of the five Provinces in the Monitored Region.
MONITORED_PROVINCE_CODES = frozenset({"ID61", "ID62", "ID63", "ID64", "ID65"})


# Tolerances (degrees) for the copies drawn on the map: about 550 m for Provinces, 220 m for Regencies.
PROVINCE_DISPLAY_TOLERANCE = 0.005
REGENCY_DISPLAY_TOLERANCE = 0.002

UPSERT_PROVINCE_SQL = """
INSERT INTO provinces (code, name, geom, geom_simple)
SELECT %(code)s, %(name)s, g,
       ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SimplifyPreserveTopology(g, %(tolerance)s)), 3))
FROM (SELECT ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%(geometry)s), 4326)) AS g) shape
ON CONFLICT (code) DO UPDATE
    SET name = EXCLUDED.name, geom = EXCLUDED.geom, geom_simple = EXCLUDED.geom_simple
"""

UPSERT_REGENCY_SQL = """
INSERT INTO regencies (code, name, province_code, geom, geom_simple)
SELECT %(code)s, %(name)s, %(province_code)s, g,
       ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_SimplifyPreserveTopology(g, %(tolerance)s)), 3))
FROM (SELECT ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(%(geometry)s), 4326)) AS g) shape
ON CONFLICT (code) DO UPDATE
    SET name = EXCLUDED.name,
        province_code = EXCLUDED.province_code,
        geom = EXCLUDED.geom,
        geom_simple = EXCLUDED.geom_simple
"""


def load_boundaries(
    conn: psycopg.Connection,
    provinces: Iterable[dict],
    regencies: Iterable[dict],
) -> None:
    """Load OCHA COD-AB admin1/admin2 GeoJSON features, keeping only the Monitored Region."""
    ensure_schema(conn)
    for feature in provinces:
        props = feature["properties"]
        if props["adm1_pcode"] not in MONITORED_PROVINCE_CODES:
            continue
        conn.execute(
            UPSERT_PROVINCE_SQL,
            {
                "code": props["adm1_pcode"],
                "name": props["adm1_name"],
                "geometry": json.dumps(feature["geometry"]),
                "tolerance": PROVINCE_DISPLAY_TOLERANCE,
            },
        )
    for feature in regencies:
        props = feature["properties"]
        if props["adm1_pcode"] not in MONITORED_PROVINCE_CODES:
            continue
        conn.execute(
            UPSERT_REGENCY_SQL,
            {
                "code": props["adm2_pcode"],
                "name": props["adm2_name"],
                "province_code": props["adm1_pcode"],
                "geometry": json.dumps(feature["geometry"]),
                "tolerance": REGENCY_DISPLAY_TOLERANCE,
            },
        )
    conn.commit()

def _stream_features(archive: zipfile.ZipFile, member: str) -> Iterator[dict]:
    # The national admin files are large (100 MB+), so features are streamed, not loaded whole.
    with archive.open(member) as handle:
        yield from ijson.items(handle, "features.item", use_float=True)


def load_boundaries_from_zip(conn: psycopg.Connection, archive_path: Path | str) -> None:
    """Load the OCHA COD-AB Indonesia GeoJSON archive downloaded from HDX."""
    with zipfile.ZipFile(archive_path) as archive:
        load_boundaries(
            conn,
            _stream_features(archive, "idn_admin1.geojson"),
            _stream_features(archive, "idn_admin2.geojson"),
        )
