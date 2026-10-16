import psycopg
import pytest

from app.backfill import run_backfill
from app.boundaries import load_boundaries
from app.ingestion import run_ingestion
from app.peatlands import load_peatlands
from tests import fixtures
from tests.fake_firms import csv_row, firms_csv
from tests.helpers import IN_KALBAR_NO_REGENCY, IN_PONTIANAK, IN_SAMBAS, hotspots


@pytest.fixture
def ingest(api, fake_firms, settings_for):
    def _ingest(*rows):
        fake_firms.respond("VIIRS_SNPP_NRT", firms_csv(*rows))
        run_ingestion(settings_for)

    return _ingest


@pytest.fixture
def backfill(database_url):
    def _run():
        with psycopg.connect(database_url) as conn:
            return run_backfill(conn)

    return _run


@pytest.fixture
def replace_datasets(database_url):
    """Swap the reference datasets the way an operator would: load new polygons over the old."""

    def _replace(provinces=None, regencies=None, peat=None):
        with psycopg.connect(database_url) as conn:
            if provinces is not None or regencies is not None:
                load_boundaries(
                    conn,
                    provinces if provinces is not None else fixtures.ALL_PROVINCES,
                    regencies if regencies is not None else fixtures.ALL_REGENCIES,
                )
            if peat is not None:
                load_peatlands(conn, peat)

    return _replace


def only(api):
    [feature] = hotspots(api)
    return feature["properties"]


def test_hotspots_stored_before_peatland_was_loaded_become_peat_hotspots(
    ingest, backfill, replace_datasets, api
):
    ingest(csv_row(*IN_SAMBAS, "2026-10-16", 540))
    assert only(api)["peat_hotspot"] is False

    replace_datasets(peat=[fixtures.PEAT_NEAR_SAMBAS])
    result = backfill()

    assert only(api)["peat_hotspot"] is True
    assert result.changed == 1


def test_a_peat_hotspot_stops_being_one_when_the_peatland_changes(
    ingest, backfill, replace_datasets, api
):
    replace_datasets(peat=[fixtures.PEAT_NEAR_SAMBAS])
    ingest(csv_row(*IN_SAMBAS, "2026-10-16", 540))
    assert only(api)["peat_hotspot"] is True

    replace_datasets(peat=[fixtures.peat(110.6, 0.6, 0.3)])
    backfill()

    assert only(api)["peat_hotspot"] is False


def test_a_hotspot_follows_its_regency_when_the_boundaries_change(
    ingest, backfill, replace_datasets, api
):
    ingest(csv_row(*IN_SAMBAS, "2026-10-16", 540))
    assert only(api)["regency"]["name"] == "Sambas"

    # Redrawn Regencies: Pontianak now covers the old Sambas square and Sambas moves away.
    pontianak_moved = fixtures.regency("ID6171", "Pontianak", "ID61", "Kalimantan Barat", 110.0, 0.0)
    sambas_moved = fixtures.regency("ID6101", "Sambas", "ID61", "Kalimantan Barat", 110.5, 0.5)
    replace_datasets(regencies=[pontianak_moved, sambas_moved])
    result = backfill()

    assert only(api)["regency"] == {"code": "ID6171", "name": "Pontianak"}
    assert result.changed == 1


def test_a_hotspot_gains_a_regency_when_boundaries_now_cover_it(
    ingest, backfill, replace_datasets, api
):
    ingest(csv_row(*IN_KALBAR_NO_REGENCY, "2026-10-16", 540))
    assert only(api)["regency"] is None

    big_sambas = fixtures.regency("ID6101", "Sambas", "ID61", "Kalimantan Barat", 110.0, 0.0, size=1.0)
    replace_datasets(regencies=[big_sambas])
    backfill()

    assert only(api)["regency"] == {"code": "ID6101", "name": "Sambas"}



def test_running_the_backfill_twice_changes_nothing_the_second_time(
    ingest, backfill, replace_datasets, api
):
    ingest(csv_row(*IN_SAMBAS, "2026-10-16", 540))
    replace_datasets(peat=[fixtures.PEAT_NEAR_SAMBAS])
    assert backfill().changed == 1

    second = backfill()

    assert second.changed == 0
    assert second.total == 1


def test_the_result_counts_every_stored_hotspot(ingest, backfill, api):
    ingest(
        csv_row(*IN_SAMBAS, "2026-10-16", 540),
        csv_row(*IN_PONTIANAK, "2026-10-16", 541),
    )

    result = backfill()

    assert (result.total, result.changed, result.outside_region) == (2, 0, 0)


def test_a_hotspot_that_leaves_the_monitored_region_is_kept_and_reported(
    ingest, backfill, replace_datasets, api
):
    ingest(
        csv_row(*IN_SAMBAS, "2026-10-16", 540),
        csv_row(*IN_PONTIANAK, "2026-10-16", 541),
    )

    # Kalimantan Barat is redrawn far away from both Hotspots
    moved_kalbar = fixtures.province("ID61", "Kalimantan Barat", 119.0, 3.0)
    replace_datasets(provinces=[moved_kalbar])
    result = backfill()

    assert result.outside_region == 2
    assert result.changed == 0
    # Nothing is silently deleted: the history is still there, with its old tags
    assert len(hotspots(api)) == 2


def test_a_regency_of_another_province_is_not_assigned_by_the_backfill(
    ingest, backfill, replace_datasets, api
):
    ingest(csv_row(*IN_KALBAR_NO_REGENCY, "2026-10-16", 540))
    assert only(api)["regency"] is None

    wrong_province = fixtures.regency(
        "ID6299", "Salah Provinsi", "ID62", "Kalimantan Tengah", 110.6, 0.1, 0.3
    )
    replace_datasets(regencies=[*fixtures.ALL_REGENCIES, wrong_province])
    backfill()

    assert only(api)["regency"] is None
