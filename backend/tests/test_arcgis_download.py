import json

import psycopg
import pytest

from app.arcgis import ArcGisError, download_layer, download_kalimantan_peat
from app.ingestion import run_ingestion
from app.peatlands import load_peatlands_from_file
from tests import fixtures
from tests.fake_arcgis import FakeArcGisLayer
from tests.fake_firms import csv_row, firms_csv
from tests.helpers import IN_PONTIANAK, IN_SAMBAS, hotspots


def feature(objectid, landform="Gambut Topogen Air Tawar (100 cm - < 200 cm)", west=110.0):
    return {
        "objectid": objectid,
        "properties": {"objectid": objectid, "landform": landform},
        "geometry": fixtures.square(west, 0.0, 0.3),
    }


@pytest.fixture
def layer():
    server = FakeArcGisLayer([feature(i) for i in range(1, 6)])
    server.start()
    yield server
    server.stop()


def read_features(path):
    return json.loads(path.read_text())["features"]


def quick(**options):
    return {"sleep": lambda seconds: None, **options}


def test_downloads_every_feature_in_object_id_order(layer, tmp_path):
    out = tmp_path / "layer.geojson"

    download_layer(layer.url, out, ids_per_request=2, workers=3, **quick())

    assert [f["properties"]["objectid"] for f in read_features(out)] == [1, 2, 3, 4, 5]


def test_features_are_requested_in_small_batches(layer, tmp_path):
    download_layer(layer.url, tmp_path / "layer.geojson", ids_per_request=2, workers=3, **quick())

    batches = [r["objectIds"] for r in layer.requests if "objectIds" in r]
    assert sorted(batches) == ["1,2", "3,4", "5"]


def test_geometry_is_asked_for_in_wgs84_and_simplified_on_the_server(layer, tmp_path):
    download_layer(
        layer.url, tmp_path / "layer.geojson", ids_per_request=5, max_allowable_offset=0.0001, **quick()
    )

    [request] = [r for r in layer.requests if "objectIds" in r]
    assert request["outSR"] == "4326"
    assert request["maxAllowableOffset"] == "0.0001"
    assert request["f"] == "geojson"


def test_a_temporary_server_error_is_retried(layer, tmp_path):
    layer.failures_left[(3, 4)] = 2

    download_layer(layer.url, tmp_path / "layer.geojson", ids_per_request=2, workers=2, **quick())

    assert len(read_features(tmp_path / "layer.geojson")) == 5


def test_a_batch_that_keeps_failing_aborts_and_leaves_no_half_written_file(layer, tmp_path):
    layer.always_fail.add((3, 4))
    out = tmp_path / "layer.geojson"

    with pytest.raises(ArcGisError):
        download_layer(layer.url, out, ids_per_request=2, workers=2, **quick())

    assert not out.exists()


def test_the_kalimantan_peat_download_drops_the_header_row_the_source_contains(tmp_path):
    # The real BIG layer carries one junk row whose values are the column names themselves.
    server = FakeArcGisLayer([feature(1), feature(2, landform="landform"), feature(3, "Kubah Gambut (300 cm - < 500 cm)")])
    server.start()
    try:
        out = tmp_path / "peat.geojson"
        download_kalimantan_peat(out, layer_url=server.url, **quick())
    finally:
        server.stop()

    assert [f["properties"]["objectid"] for f in read_features(out)] == [1, 3]


def test_a_downloaded_layer_loads_as_peatland(api, fake_firms, settings_for, database_url, layer, tmp_path):
    out = tmp_path / "peat.geojson"
    download_layer(layer.url, out, **quick())  # five identical squares over 110-110.3 E, 0-0.3 N
    with psycopg.connect(database_url) as conn:
        load_peatlands_from_file(conn, out)

    fake_firms.respond(
        "VIIRS_SNPP_NRT",
        firms_csv(csv_row(*IN_SAMBAS, "2026-10-16", 540), csv_row(*IN_PONTIANAK, "2026-10-16", 541)),
    )
    run_ingestion(settings_for)

    flags = {tuple(f["geometry"]["coordinates"]): f["properties"]["peat_hotspot"] for f in hotspots(api)}
    assert flags == {(110.25, 0.25): True, (110.75, 0.75): False}
