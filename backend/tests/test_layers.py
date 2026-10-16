import random

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.boundaries import load_boundaries
from app.main import create_app
from app.peatlands import load_peatlands
from tests import fixtures


def coordinates(geometry):
    """Every [lon, lat] position of a Polygon or MultiPolygon, flattened."""
    def walk(node):
        if node and isinstance(node[0], (int, float)):
            yield node
        else:
            for child in node:
                yield from walk(child)

    return list(walk(geometry["coordinates"]))


def bounds(geometry):
    points = coordinates(geometry)
    lons, lats = [p[0] for p in points], [p[1] for p in points]
    return min(lons), min(lats), max(lons), max(lats)


def layer(api, name):
    response = api.get(f"/layers/{name}")
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "FeatureCollection"
    return body["features"]


def test_the_peatland_layer_serves_the_loaded_polygons(api, database_url):
    with psycopg.connect(database_url) as conn:
        load_peatlands(conn, [fixtures.PEAT_NEAR_SAMBAS])

    [feature] = layer(api, "peatlands")

    assert feature["geometry"]["type"] in ("Polygon", "MultiPolygon")
    assert bounds(feature["geometry"]) == pytest.approx((110.0, 0.0, 110.3, 0.3))


def test_without_peatland_the_layer_is_simply_empty(api):
    assert layer(api, "peatlands") == []


def test_the_province_layer_has_the_five_kalimantan_provinces(api):
    features = layer(api, "provinces")

    assert sorted(f["properties"]["name"] for f in features) == [
        "Kalimantan Barat",
        "Kalimantan Selatan",
        "Kalimantan Tengah",
        "Kalimantan Timur",
        "Kalimantan Utara",
    ]
    kalbar = next(f for f in features if f["properties"]["code"] == "ID61")
    assert bounds(kalbar["geometry"]) == pytest.approx((110.0, 0.0, 111.0, 1.0))


def test_the_regency_layer_names_each_regency_and_its_province(api):
    features = layer(api, "regencies")

    assert sorted(
        (f["properties"]["name"], f["properties"]["province_code"]) for f in features
    ) == [("Palangka Raya", "ID62"), ("Pontianak", "ID61"), ("Sambas", "ID61")]


def test_boundaries_outside_kalimantan_are_not_served(api):
    codes = {f["properties"]["code"] for f in layer(api, "provinces")}
    names = {f["properties"]["name"] for f in layer(api, "regencies")}

    assert "ID32" not in codes
    assert "Bandung" not in names


def test_detailed_boundaries_are_simplified_for_the_browser(database_url, monkeypatch):
    # A province edge traced with thousands of vertices, as in the real 100 MB boundary files
    random.seed(7)
    jagged = []
    steps = 3000
    for i in range(steps):  # south edge, west to east, with tiny noise
        jagged.append([110.0 + i / steps, 0.0 + random.uniform(-1e-5, 1e-5)])
    ring = jagged + [[111.0, 0.0], [111.0, 1.0], [110.0, 1.0], jagged[0]]
    kalbar = {
        "type": "Feature",
        "properties": {"adm1_pcode": "ID61", "adm1_name": "Kalimantan Barat"},
        "geometry": {"type": "MultiPolygon", "coordinates": [[ring]]},
    }
    monkeypatch.setenv("DATABASE_URL", database_url)
    with TestClient(create_app()) as client:
        with psycopg.connect(database_url) as conn:
            load_boundaries(conn, [kalbar], [])
        [feature] = layer(client, "provinces")

    assert len(coordinates(feature["geometry"])) < 100  # from over 3,000
    assert bounds(feature["geometry"]) == pytest.approx((110.0, 0.0, 111.0, 1.0), abs=0.01)


def test_layers_may_be_cached_by_the_browser(api):
    for name in ("peatlands", "provinces", "regencies"):
        assert "max-age=3600" in api.get(f"/layers/{name}").headers["cache-control"]


def test_boundaries_loaded_before_layers_existed_are_still_served(
    api, database_url, monkeypatch
):
    # Simulate a database filled by an older version: no display geometry stored yet
    with psycopg.connect(database_url) as conn:
        conn.execute("UPDATE provinces SET geom_simple = NULL")
        conn.execute("UPDATE regencies SET geom_simple = NULL")
        conn.commit()
    monkeypatch.setenv("DATABASE_URL", database_url)

    with TestClient(create_app()) as restarted:
        assert len(layer(restarted, "provinces")) == 5
        assert len(layer(restarted, "regencies")) == 3
