import io
import json
import zipfile
from collections.abc import Iterable, Iterator
from pathlib import Path

import ijson
import psycopg
import shapefile

from app.schema import ensure_schema


def load_peatlands(
    conn: psycopg.Connection, features: Iterable[dict], srid: int = 4326
) -> None:
    """Replace the Peatland polygons with the given GeoJSON features.

    `srid` is the coordinate system of the input (4326 means WGS84 longitude/latitude); polygons are
    always stored in WGS84. Invalid polygons, common in peat maps, are repaired rather than rejected.
    """
    ensure_schema(conn)
    conn.execute("DELETE FROM peatlands")
    for feature in features:
        conn.execute(
            """
            INSERT INTO peatlands (geom)
            VALUES (ST_Multi(ST_CollectionExtract(ST_MakeValid(
                ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(%s), %s), 4326)), 3)))
            """,
            (json.dumps(feature["geometry"]), srid),
        )
    conn.commit()


def _geojson_features(path: Path) -> Iterator[dict]:
    with path.open("rb") as handle:
        yield from ijson.items(handle, "features.item", use_float=True)


def _shapefile_features(path: Path) -> Iterator[dict]:
    with zipfile.ZipFile(path) as archive:
        names = {name.lower(): name for name in archive.namelist()}
        shp_names = [name for lower, name in names.items() if lower.endswith(".shp")]
        if len(shp_names) != 1:
            raise ValueError(f"Expected exactly one .shp in {path.name}, found {len(shp_names)}")
        stem = shp_names[0][: -len(".shp")]
        shx_name = names.get(f"{stem}.shx".lower())
        with archive.open(shp_names[0]) as shp:
            shp_bytes = io.BytesIO(shp.read())
        shx_bytes = io.BytesIO(archive.read(shx_name)) if shx_name else None
    # Only the geometry is needed, so the attribute table (.dbf) is not read.
    reader = shapefile.Reader(shp=shp_bytes, shx=shx_bytes)
    for shape in reader.iterShapes():
        if shape.shapeType == shapefile.NULL:
            continue
        yield {"type": "Feature", "properties": {}, "geometry": shape.__geo_interface__}


def load_peatlands_from_file(
    conn: psycopg.Connection, path: Path | str, srid: int = 4326
) -> None:
    """Load Peatland polygons from a GeoJSON file or a zipped shapefile."""
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix in (".geojson", ".json"):
        features = _geojson_features(path)
    elif suffix == ".zip":
        features = _shapefile_features(path)
    else:
        raise ValueError(f"Unsupported peat file type: {path.name} (use .geojson, .json or .zip)")
    load_peatlands(conn, features, srid=srid)
