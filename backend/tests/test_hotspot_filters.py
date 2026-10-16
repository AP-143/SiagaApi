import pytest

from app.ingestion import run_ingestion
from tests.fake_firms import csv_row, firms_csv
from tests.helpers import (
    IN_PALANGKA_RAYA,
    IN_PONTIANAK,
    IN_SAMBAS,
    hotspots,
)

# "Now" is 2026-10-16 08:00 UTC (see conftest).


def coordinates(features):
    return sorted(tuple(f["geometry"]["coordinates"]) for f in features)


@pytest.fixture
def ingest(api, fake_firms, settings_for):
    def _ingest(*rows):
        fake_firms.respond("VIIRS_SNPP_NRT", firms_csv(*rows))
        run_ingestion(settings_for)

    return _ingest


def test_time_window_defaults_to_24_hours(ingest, api):
    ingest(
        csv_row(*IN_SAMBAS, "2026-10-16", 540),  # 2h20 ago
        csv_row(*IN_PONTIANAK, "2026-10-15", 700),  # 25h ago
    )

    assert coordinates(hotspots(api)) == [(110.25, 0.25)]


def test_48_hour_window_includes_yesterday_but_not_older(ingest, api):
    ingest(
        csv_row(*IN_SAMBAS, "2026-10-15", 700),  # 25h ago
        csv_row(*IN_PONTIANAK, "2026-10-14", 700),  # 49h ago
    )

    assert coordinates(hotspots(api, window="48h")) == [(110.25, 0.25)]


def test_7_day_window_reaches_back_a_week(ingest, api):
    ingest(
        csv_row(*IN_SAMBAS, "2026-10-10", 700),  # 6 days ago
        csv_row(*IN_PONTIANAK, "2026-10-08", 700),  # 8 days ago
    )

    assert coordinates(hotspots(api, window="7d")) == [(110.25, 0.25)]


def test_an_unknown_time_window_is_rejected(api):
    assert api.get("/hotspots", params={"window": "1y"}).status_code == 422


def test_filters_by_province(ingest, api):
    ingest(
        csv_row(*IN_SAMBAS, "2026-10-16", 540),
        csv_row(*IN_PALANGKA_RAYA, "2026-10-16", 541),
    )

    assert coordinates(hotspots(api, province="ID62")) == [(112.25, -1.75)]


def test_filters_by_regency(ingest, api):
    ingest(
        csv_row(*IN_SAMBAS, "2026-10-16", 540),
        csv_row(*IN_PONTIANAK, "2026-10-16", 541),
    )

    assert coordinates(hotspots(api, regency="ID6171")) == [(110.75, 0.75)]


def test_filters_combine(ingest, api):
    ingest(
        csv_row(*IN_SAMBAS, "2026-10-16", 540),  # Kalbar, Sambas, 2h ago
        csv_row(*IN_SAMBAS, "2026-10-15", 700),  # Kalbar, Sambas, 25h ago
        csv_row(*IN_PONTIANAK, "2026-10-15", 700),  # Kalbar, Pontianak, 25h ago
        csv_row(*IN_PALANGKA_RAYA, "2026-10-15", 700),  # Kalteng, 25h ago
    )

    result = hotspots(api, province="ID61", regency="ID6101", window="48h")

    assert [f["properties"]["acquired_at"] for f in result] == [
        "2026-10-16T05:40:00Z",
        "2026-10-15T07:00:00Z",
    ]


def test_a_regency_from_another_province_matches_nothing(ingest, api):
    ingest(csv_row(*IN_SAMBAS, "2026-10-16", 540))

    assert hotspots(api, province="ID62", regency="ID6101") == []


def three_confidences(ingest):
    ingest(
        csv_row(*IN_SAMBAS, "2026-10-16", 540, confidence="l"),
        csv_row(*IN_PONTIANAK, "2026-10-16", 541, confidence="n"),
        csv_row(*IN_PALANGKA_RAYA, "2026-10-16", 542, confidence="h"),
    )


def confidences(features):
    return sorted(f["properties"]["confidence"] for f in features)


def test_low_confidence_hotspots_are_hidden_by_default(ingest, api):
    three_confidences(ingest)

    assert confidences(hotspots(api)) == ["high", "nominal"]


def test_low_confidence_hotspots_can_be_included(ingest, api):
    three_confidences(ingest)

    assert confidences(hotspots(api, min_confidence="low")) == ["high", "low", "nominal"]


def test_minimum_confidence_can_be_raised_to_high(ingest, api):
    three_confidences(ingest)

    assert confidences(hotspots(api, min_confidence="high")) == ["high"]


def test_an_unknown_minimum_confidence_is_rejected(api):
    assert api.get("/hotspots", params={"min_confidence": "maybe"}).status_code == 422


def test_large_hotspot_responses_are_compressed(ingest, api):
    # A real day holds thousands of Hotspots (over 1 MB of JSON), too heavy for a phone uncompressed.
    ingest(*[csv_row(0.25, 110.0 + i * 0.0001, "2026-10-16", 540) for i in range(200)])

    response = api.get("/hotspots", headers={"Accept-Encoding": "gzip"})

    assert response.status_code == 200
    assert response.headers["content-encoding"] == "gzip"
