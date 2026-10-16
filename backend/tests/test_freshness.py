from datetime import datetime, timezone

import pytest

from app.firms import FirmsError
from app.ingestion import run_ingestion
from tests.fake_firms import csv_row, firms_csv
from tests.helpers import IN_SAMBAS, hotspots

# The API's clock is frozen at 2026-10-16 08:00 UTC (see conftest).


def at(hour, minute=0, second=0):
    return lambda: datetime(2026, 10, 16, hour, minute, second, tzinfo=timezone.utc)


@pytest.fixture
def ingest_at(api, fake_firms, settings_for):
    def _ingest(clock, *rows):
        fake_firms.respond("VIIRS_SNPP_NRT", firms_csv(*rows))
        run_ingestion(settings_for, clock=clock)

    return _ingest


def freshness(api):
    response = api.get("/freshness")
    assert response.status_code == 200
    return response.json()


def test_before_any_ingestion_the_data_counts_as_stale(api):
    assert freshness(api) == {"last_updated": None, "stale": True}


def test_after_a_recent_ingestion_the_data_is_fresh(api, ingest_at):
    ingest_at(at(7), csv_row(*IN_SAMBAS, "2026-10-16", 540))

    assert freshness(api) == {"last_updated": "2026-10-16T07:00:00Z", "stale": False}


def test_exactly_six_hours_old_is_still_fresh(api, ingest_at):
    ingest_at(at(2, 0, 0))

    assert freshness(api) == {"last_updated": "2026-10-16T02:00:00Z", "stale": False}


def test_six_hours_and_one_second_is_stale(api, ingest_at):
    ingest_at(at(1, 59, 59))

    assert freshness(api) == {"last_updated": "2026-10-16T01:59:59Z", "stale": True}


def test_the_latest_successful_run_is_the_one_that_counts(api, ingest_at):
    ingest_at(at(1, 0))
    ingest_at(at(7, 30))

    assert freshness(api)["last_updated"] == "2026-10-16T07:30:00Z"


def test_a_failed_run_keeps_the_last_update_time_and_the_stored_hotspots(
    api, fake_firms, settings_for, ingest_at
):
    ingest_at(at(7), csv_row(*IN_SAMBAS, "2026-10-16", 540))
    fake_firms.respond("VIIRS_SNPP_NRT", "server exploded", status=500)

    with pytest.raises(FirmsError):
        run_ingestion(settings_for, clock=at(7, 30))

    assert freshness(api) == {"last_updated": "2026-10-16T07:00:00Z", "stale": False}
    assert len(hotspots(api)) == 1
