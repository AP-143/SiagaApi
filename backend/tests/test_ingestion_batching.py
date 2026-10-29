"""The scheduled ingest runs on GitHub, an ocean away from the database, so every statement it sends costs a
round trip of a fifth of a second. Storing detections one statement at a time took longer than the ten
minutes the workflow is allowed; the number of statements must not grow with the number of detections."""

import psycopg
import pytest

from app.ingestion import run_ingestion
from tests.fake_firms import csv_row, firms_csv
from tests.helpers import IN_SAMBAS, hotspots

DETECTIONS = 300
MOST_STATEMENTS = 15  # the schema check, the batch, the run record: a handful, whatever the count


class CountingCursor(psycopg.Cursor):
    statements = 0

    def execute(self, *args, **kwargs):
        CountingCursor.statements += 1
        return super().execute(*args, **kwargs)

    def executemany(self, *args, **kwargs):  # one call can be many statements
        CountingCursor.statements += 1000
        return super().executemany(*args, **kwargs)


@pytest.fixture
def counting(monkeypatch):
    real_connect = psycopg.connect
    CountingCursor.statements = 0
    monkeypatch.setattr(
        psycopg, "connect", lambda *a, **kw: real_connect(*a, cursor_factory=CountingCursor, **kw)
    )
    return CountingCursor


def many_rows():
    times = [hour * 100 + minute for hour in range(5) for minute in range(60)]  # 300 different HHMM
    return [csv_row(*IN_SAMBAS, "2026-10-16", time) for time in times[:DETECTIONS]]


def test_the_number_of_statements_does_not_grow_with_the_number_of_detections(
    api, fake_firms, settings_for, counting
):
    fake_firms.respond("VIIRS_SNPP_NRT", firms_csv(*many_rows()))

    result = run_ingestion(settings_for)

    assert result.stored == DETECTIONS
    assert counting.statements <= MOST_STATEMENTS


def test_a_second_run_over_the_same_detections_stores_nothing_new(api, fake_firms, settings_for):
    fake_firms.respond("VIIRS_SNPP_NRT", firms_csv(*many_rows()))
    run_ingestion(settings_for)

    again = run_ingestion(settings_for)

    assert again.fetched == DETECTIONS
    assert again.stored == 0
    assert len(hotspots(api)) == DETECTIONS


def test_the_same_detection_twice_in_one_batch_is_stored_once(api, fake_firms, settings_for):
    row = csv_row(*IN_SAMBAS, "2026-10-16", 540)
    fake_firms.respond("VIIRS_SNPP_NRT", firms_csv(row, row))

    result = run_ingestion(settings_for)

    assert result.stored == 1
