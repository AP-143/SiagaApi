import logging

import pytest

from app.firms import FirmsError
from app.ingestion import run_ingestion, run_on_schedule
from tests.fake_firms import csv_row, firms_csv
from tests.helpers import (
    IN_KALBAR_NO_REGENCY,
    IN_PONTIANAK,
    IN_SAMBAS,
    OFFSHORE,
    OUTSIDE_KALIMANTAN,
    SECRET_KEY,
    hotspots,
    without_ids,
)


def test_ingested_hotspot_is_listed_with_its_province_and_regency(api, fake_firms, settings_for):
    fake_firms.respond(
        "VIIRS_SNPP_NRT",
        firms_csv(csv_row(*IN_SAMBAS, "2026-10-16", 540, satellite="N", confidence="h")),
    )

    run_ingestion(settings_for)

    assert without_ids(hotspots(api)) == [
        {
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [110.25, 0.25]},
            "properties": {
                "acquired_at": "2026-10-16T05:40:00Z",
                "satellite": "S-NPP",
                "confidence": "high",
                "province": {"code": "ID61", "name": "Kalimantan Barat"},
                "regency": {"code": "ID6101", "name": "Sambas"},
                "peat_hotspot": False,
            },
        }
    ]


def test_hotspot_inside_a_province_but_outside_every_regency_has_no_regency(
    api, fake_firms, settings_for
):
    fake_firms.respond(
        "VIIRS_SNPP_NRT", firms_csv(csv_row(*IN_KALBAR_NO_REGENCY, "2026-10-16", 540))
    )

    run_ingestion(settings_for)

    [feature] = hotspots(api)
    assert feature["properties"]["province"]["code"] == "ID61"
    assert feature["properties"]["regency"] is None


def test_hotspots_outside_the_monitored_region_are_discarded(api, fake_firms, settings_for):
    fake_firms.respond(
        "VIIRS_SNPP_NRT",
        firms_csv(
            csv_row(*IN_PONTIANAK, "2026-10-16", 540),
            csv_row(*OFFSHORE, "2026-10-16", 541),
            csv_row(*OUTSIDE_KALIMANTAN, "2026-10-16", 542),
        ),
    )

    run_ingestion(settings_for)

    [feature] = hotspots(api)
    assert feature["geometry"]["coordinates"] == [110.75, 0.75]


def test_running_ingestion_again_over_the_same_data_creates_no_duplicates(
    api, fake_firms, settings_for
):
    fake_firms.respond("VIIRS_SNPP_NRT", firms_csv(csv_row(*IN_SAMBAS, "2026-10-16", 540)))

    run_ingestion(settings_for)
    second = run_ingestion(settings_for)

    assert len(hotspots(api)) == 1
    assert second.stored == 0


def test_overlapping_windows_only_add_the_new_hotspots(api, fake_firms, settings_for):
    fake_firms.respond("VIIRS_SNPP_NRT", firms_csv(csv_row(*IN_SAMBAS, "2026-10-16", 540)))
    run_ingestion(settings_for)

    fake_firms.respond(
        "VIIRS_SNPP_NRT",
        firms_csv(
            csv_row(*IN_SAMBAS, "2026-10-16", 540),
            csv_row(*IN_PONTIANAK, "2026-10-16", 700),
        ),
    )
    run_ingestion(settings_for)

    assert len(hotspots(api)) == 2


def test_the_same_location_seen_by_two_satellites_is_two_hotspots(api, fake_firms, settings_for):
    fake_firms.respond(
        "VIIRS_SNPP_NRT", firms_csv(csv_row(*IN_SAMBAS, "2026-10-16", 540, satellite="N"))
    )
    fake_firms.respond(
        "VIIRS_NOAA20_NRT", firms_csv(csv_row(*IN_SAMBAS, "2026-10-16", 540, satellite="N20"))
    )

    run_ingestion(settings_for)

    satellites = sorted(f["properties"]["satellite"] for f in hotspots(api))
    assert satellites == ["NOAA-20", "S-NPP"]


def test_all_three_viirs_satellites_are_fetched(api, fake_firms, settings_for):
    fake_firms.respond("VIIRS_NOAA21_NRT", firms_csv(csv_row(*IN_SAMBAS, "2026-10-16", 444, satellite="N21")))

    run_ingestion(settings_for)

    requested_sources = {path.split("/")[5] for path in fake_firms.requests}
    assert requested_sources == {"VIIRS_SNPP_NRT", "VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT"}
    assert [f["properties"]["satellite"] for f in hotspots(api)] == ["NOAA-21"]


@pytest.mark.parametrize(
    "code, expected", [("l", "low"), ("n", "nominal"), ("h", "high")]
)
def test_confidence_is_normalized_to_low_nominal_or_high(
    api, fake_firms, settings_for, code, expected
):
    fake_firms.respond(
        "VIIRS_SNPP_NRT", firms_csv(csv_row(*IN_SAMBAS, "2026-10-16", 540, confidence=code))
    )

    run_ingestion(settings_for)

    assert hotspots(api, min_confidence="low")[0]["properties"]["confidence"] == expected


def test_hotspots_older_than_24_hours_are_not_listed(api, fake_firms, settings_for):
    fake_firms.respond(
        "VIIRS_SNPP_NRT",
        firms_csv(
            csv_row(*IN_SAMBAS, "2026-10-16", 540),  # 2h20 before "now"
            csv_row(*IN_PONTIANAK, "2026-10-15", 700),  # 25h before "now"
        ),
    )

    run_ingestion(settings_for)

    assert [f["geometry"]["coordinates"] for f in hotspots(api)] == [[110.25, 0.25]]


def test_a_failing_firms_source_stores_nothing_and_never_leaks_the_map_key(
    api, fake_firms, settings_for
):
    fake_firms.respond("VIIRS_SNPP_NRT", firms_csv(csv_row(*IN_SAMBAS, "2026-10-16", 540)))
    fake_firms.respond("VIIRS_NOAA20_NRT", "server exploded", status=500)

    with pytest.raises(FirmsError) as error:
        run_ingestion(settings_for)

    assert SECRET_KEY not in str(error.value)
    assert hotspots(api) == []


def test_a_plain_text_error_from_firms_is_reported_as_a_failure(api, fake_firms, settings_for):
    fake_firms.respond("VIIRS_SNPP_NRT", "Invalid MAP_KEY.")

    with pytest.raises(FirmsError) as error:
        run_ingestion(settings_for)

    assert SECRET_KEY not in str(error.value)


def test_the_scheduler_keeps_running_after_a_failed_run(api, fake_firms, settings_for, caplog):
    caplog.set_level(logging.INFO)  # include library logs such as httpx request lines
    fake_firms.respond("VIIRS_SNPP_NRT", "server exploded", status=500)
    sleeps = []

    def sleep_then_fix_firms(seconds):
        sleeps.append(seconds)
        fake_firms.respond("VIIRS_SNPP_NRT", firms_csv(csv_row(*IN_SAMBAS, "2026-10-16", 540)))

    run_on_schedule(settings_for, interval_seconds=1800, sleep=sleep_then_fix_firms, max_runs=2)

    assert sleeps == [1800]
    assert len(hotspots(api)) == 1
    assert SECRET_KEY not in caplog.text
