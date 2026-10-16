"""Shared locations and helpers for tests that go through ingestion and the read API."""

from datetime import timedelta

from tests.conftest import NOW

SECRET_KEY = "TESTKEY-SECRET-123"


class MutableClock:
    """A clock a test can move forward, for behavior that depends on time passing."""

    def __init__(self):
        self.now = NOW

    def __call__(self):
        return self.now

    def advance(self, **delta):
        self.now += timedelta(**delta)

# Locations on the fixture map: Sambas (110-110.5 E, 0-0.5 N) and Pontianak (110.5-111, 0.5-1)
# are the two Regencies of Kalimantan Barat (110-111 E, 0-1 N). Palangka Raya (112-112.5 E,
# -2 to -1.5 N) is the one Regency of Kalimantan Tengah in the fixtures.
IN_SAMBAS = (0.25, 110.25)
IN_PONTIANAK = (0.75, 110.75)
IN_KALBAR_NO_REGENCY = (0.25, 110.75)
IN_PALANGKA_RAYA = (-1.75, 112.25)
OFFSHORE = (0.5, 105.0)
OUTSIDE_KALIMANTAN = (5.0, 100.0)


def hotspots(api, **params):
    response = api.get("/hotspots", params=params)
    assert response.status_code == 200
    return response.json()["features"]


def without_ids(features):
    """Database ids are an internal detail; every Hotspot must have one, but its value is free."""
    stripped = []
    for feature in features:
        properties = dict(feature["properties"])
        assert isinstance(properties.pop("id"), int)
        stripped.append({**feature, "properties": properties})
    return stripped
