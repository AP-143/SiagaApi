import json
import zipfile

import psycopg
import pytest
import shapefile

from app.ingestion import run_ingestion
from app.peatlands import load_peatlands, load_peatlands_from_file
from tests import fixtures
from tests.fake_firms import csv_row, firms_csv
from tests.helpers import IN_PONTIANAK, IN_SAMBAS, hotspots


@pytest.fixture
def ingest(api, fake_firms, settings_for):
    def _ingest(*rows):
        fake_firms.respond("VIIRS_SNPP_NRT", firms_csv(*rows))
        run_ingestion(settings_for)

    return _ingest


@pytest.fixture
def load_peat(database_url):
    def _load(*features):
        with psycopg.connect(database_url) as conn:
            load_peatlands(conn, features)

    return _load


def flags(features):
    return {tuple(f["geometry"]["coordinates"]): f["properties"]["peat_hotspot"] for f in features}


def test_a_hotspot_inside_peatland_is_a_peat_hotspot(ingest, load_peat, api):
    load_peat(fixtures.PEAT_NEAR_SAMBAS)

    ingest(
        csv_row(*IN_SAMBAS, "2026-10-16", 540),
        csv_row(*IN_PONTIANAK, "2026-10-16", 541),
    )

    assert flags(hotspots(api)) == {(110.25, 0.25): True, (110.75, 0.75): False}


def test_peat_only_returns_just_the_peat_hotspots(ingest, load_peat, api):
    load_peat(fixtures.PEAT_NEAR_SAMBAS)
    ingest(
        csv_row(*IN_SAMBAS, "2026-10-16", 540),
        csv_row(*IN_PONTIANAK, "2026-10-16", 541),
    )

    assert flags(hotspots(api, peat_only="true")) == {(110.25, 0.25): True}


def test_without_peat_only_every_hotspot_is_listed(ingest, load_peat, api):
    load_peat(fixtures.PEAT_NEAR_SAMBAS)
    ingest(
        csv_row(*IN_SAMBAS, "2026-10-16", 540),
        csv_row(*IN_PONTIANAK, "2026-10-16", 541),
    )

    assert len(hotspots(api)) == 2
    assert len(hotspots(api, peat_only="false")) == 2


def test_with_no_peatland_loaded_nothing_is_a_peat_hotspot(ingest, api):
    ingest(csv_row(*IN_SAMBAS, "2026-10-16", 540))

    assert flags(hotspots(api)) == {(110.25, 0.25): False}
    assert hotspots(api, peat_only="true") == []


# --- reading real-world peat files -------------------------------------------------------


def write_geojson(path, *features):
    path.write_text(json.dumps({"type": "FeatureCollection", "features": list(features)}))
    return path


def write_zipped_shapefile(path, west, south, size):
    """A shapefile with one square polygon (outer rings run clockwise in the format)."""
    base = path.parent / "peat"
    east, north = west + size, south + size
    writer = shapefile.Writer(str(base))
    writer.field("NAME", "C")
    writer.poly([[[west, south], [west, north], [east, north], [east, south], [west, south]]])
    writer.record("Gambut")
    writer.close()
    with zipfile.ZipFile(path, "w") as archive:
        for extension in ("shp", "shx", "dbf"):
            archive.write(f"{base}.{extension}", f"peat.{extension}")
    return path


@pytest.fixture
def load_peat_file(database_url):
    def _load(path, **options):
        with psycopg.connect(database_url) as conn:
            load_peatlands_from_file(conn, path, **options)

    return _load


def test_loads_peatland_from_a_geojson_file(ingest, load_peat_file, api, tmp_path):
    load_peat_file(write_geojson(tmp_path / "peat.geojson", fixtures.PEAT_NEAR_SAMBAS))

    ingest(csv_row(*IN_SAMBAS, "2026-10-16", 540), csv_row(*IN_PONTIANAK, "2026-10-16", 541))

    assert flags(hotspots(api)) == {(110.25, 0.25): True, (110.75, 0.75): False}


def test_loads_peatland_from_a_zipped_shapefile(ingest, load_peat_file, api, tmp_path):
    load_peat_file(write_zipped_shapefile(tmp_path / "peat.zip", 110.0, 0.0, 0.3))

    ingest(csv_row(*IN_SAMBAS, "2026-10-16", 540), csv_row(*IN_PONTIANAK, "2026-10-16", 541))

    assert flags(hotspots(api)) == {(110.25, 0.25): True, (110.75, 0.75): False}


def test_peatland_in_another_coordinate_system_is_reprojected(
    ingest, load_peat_file, api, tmp_path
):
    # A 20 km box in UTM zone 49N (EPSG:32649) around easting 416,510 / northing 27,640, which is
    # about 110.25 E, 0.25 N. Pontianak's spot (110.75 E, 0.75 N) lies near easting 472,000.
    utm_box = {
        "type": "Feature",
        "properties": {},
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [[406510, 17640], [426510, 17640], [426510, 37640], [406510, 37640], [406510, 17640]]
            ],
        },
    }
    load_peat_file(write_geojson(tmp_path / "peat_utm.geojson", utm_box), srid=32649)

    ingest(csv_row(*IN_SAMBAS, "2026-10-16", 540), csv_row(*IN_PONTIANAK, "2026-10-16", 541))

    assert flags(hotspots(api)) == {(110.25, 0.25): True, (110.75, 0.75): False}


def test_loading_peatland_again_replaces_the_previous_dataset(ingest, load_peat, api):
    load_peat(fixtures.PEAT_NEAR_SAMBAS)
    load_peat(fixtures.peat(110.6, 0.6, 0.3))  # covers Pontianak's spot, not Sambas's

    ingest(csv_row(*IN_SAMBAS, "2026-10-16", 540), csv_row(*IN_PONTIANAK, "2026-10-16", 541))

    assert flags(hotspots(api)) == {(110.25, 0.25): False, (110.75, 0.75): True}


def test_a_self_intersecting_peat_polygon_is_repaired_not_fatal(ingest, load_peat, api):
    bow_tie = {
        "type": "Feature",
        "properties": {},
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [[110.0, 0.0], [110.3, 0.3], [110.3, 0.0], [110.0, 0.3], [110.0, 0.0]]
            ],
        },
    }
    load_peat(bow_tie)

    ingest(
        csv_row(0.15, 110.28, "2026-10-16", 540),  # inside the right-hand triangle
        csv_row(0.28, 110.15, "2026-10-16", 541),  # in the gap above the crossing
    )

    assert flags(hotspots(api)) == {(110.28, 0.15): True, (110.15, 0.28): False}
