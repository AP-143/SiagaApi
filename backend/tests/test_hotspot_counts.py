import pytest

from app.ingestion import run_ingestion
from tests import fixtures
from tests.fake_firms import csv_row, firms_csv
from tests.helpers import (
    IN_KALBAR_NO_REGENCY,
    IN_PALANGKA_RAYA,
    IN_PONTIANAK,
    IN_SAMBAS,
    hotspots,
)


@pytest.fixture
def ingest(api, fake_firms, settings_for):
    def _ingest(*rows):
        fake_firms.respond("VIIRS_SNPP_NRT", firms_csv(*rows))
        run_ingestion(settings_for)

    return _ingest


def counts(api, **params):
    response = api.get("/hotspots/counts", params=params)
    assert response.status_code == 200
    return response.json()


def as_pairs(rows):
    return [(row["regency"]["name"] if row["regency"] else None, row["count"]) for row in rows]


def test_counts_hotspots_per_regency_busiest_first(ingest, api):
    ingest(
        csv_row(*IN_SAMBAS, "2026-10-16", 540),
        csv_row(*IN_SAMBAS, "2026-10-16", 541),
        csv_row(*IN_SAMBAS, "2026-10-16", 542),
        csv_row(*IN_PONTIANAK, "2026-10-16", 543),
        csv_row(*IN_PALANGKA_RAYA, "2026-10-16", 544),
        csv_row(*IN_PALANGKA_RAYA, "2026-10-16", 545),
    )

    assert as_pairs(counts(api)) == [("Sambas", 3), ("Palangka Raya", 2), ("Pontianak", 1)]


def test_each_row_names_the_regency_and_its_province(ingest, api):
    ingest(csv_row(*IN_SAMBAS, "2026-10-16", 540))

    assert counts(api) == [
        {
            "regency": {"code": "ID6101", "name": "Sambas"},
            "province": {"code": "ID61", "name": "Kalimantan Barat"},
            "count": 1,
        }
    ]


def test_hotspots_outside_every_regency_are_counted_together(ingest, api):
    ingest(
        csv_row(*IN_KALBAR_NO_REGENCY, "2026-10-16", 540),
        csv_row(*IN_SAMBAS, "2026-10-16", 541),
    )

    rows = counts(api)

    # Equal counts fall back to name order, with the unknown Regency last
    assert as_pairs(rows) == [("Sambas", 1), (None, 1)]
    unknown = next(row for row in rows if row["regency"] is None)
    assert unknown["province"] == {"code": "ID61", "name": "Kalimantan Barat"}


def test_counts_follow_the_same_filters_as_the_hotspot_list(ingest, api):
    ingest(
        csv_row(*IN_SAMBAS, "2026-10-16", 540, confidence="h"),  # 2h ago, high
        csv_row(*IN_SAMBAS, "2026-10-16", 541, confidence="l"),  # 2h ago, low
        csv_row(*IN_SAMBAS, "2026-10-15", 700, confidence="n"),  # 25h ago
        csv_row(*IN_PONTIANAK, "2026-10-16", 542, confidence="n"),
        csv_row(*IN_PALANGKA_RAYA, "2026-10-16", 543, confidence="n"),
    )

    assert sorted(as_pairs(counts(api))) == [("Palangka Raya", 1), ("Pontianak", 1), ("Sambas", 1)]
    assert sorted(as_pairs(counts(api, window="48h"))) == [
        ("Palangka Raya", 1),
        ("Pontianak", 1),
        ("Sambas", 2),
    ]
    assert sorted(as_pairs(counts(api, window="48h", min_confidence="low"))) == [
        ("Palangka Raya", 1),
        ("Pontianak", 1),
        ("Sambas", 3),
    ]
    assert as_pairs(counts(api, province="ID62")) == [("Palangka Raya", 1)]


def test_peat_only_counts_only_peat_hotspots(ingest, api, database_url):
    import psycopg

    from app.peatlands import load_peatlands

    with psycopg.connect(database_url) as conn:
        load_peatlands(conn, [fixtures.PEAT_NEAR_SAMBAS])
    ingest(
        csv_row(*IN_SAMBAS, "2026-10-16", 540),
        csv_row(*IN_PONTIANAK, "2026-10-16", 541),
    )

    assert as_pairs(counts(api, peat_only="true")) == [("Sambas", 1)]


@pytest.mark.parametrize(
    "filters",
    [
        {},
        {"window": "48h"},
        {"window": "7d", "min_confidence": "low"},
        {"province": "ID61"},
        {"province": "ID61", "regency": "ID6171", "window": "48h"},
        {"min_confidence": "high"},
    ],
)
def test_the_counts_always_add_up_to_the_hotspot_list(ingest, api, filters):
    ingest(
        csv_row(*IN_SAMBAS, "2026-10-16", 540, confidence="h"),
        csv_row(*IN_SAMBAS, "2026-10-15", 700, confidence="l"),
        csv_row(*IN_PONTIANAK, "2026-10-16", 541, confidence="n"),
        csv_row(*IN_PONTIANAK, "2026-10-10", 700, confidence="n"),
        csv_row(*IN_KALBAR_NO_REGENCY, "2026-10-16", 542, confidence="n"),
        csv_row(*IN_PALANGKA_RAYA, "2026-10-15", 700, confidence="h"),
    )

    assert sum(row["count"] for row in counts(api, **filters)) == len(hotspots(api, **filters))


def test_an_unknown_window_is_rejected_here_too(api):
    assert api.get("/hotspots/counts", params={"window": "1y"}).status_code == 422
