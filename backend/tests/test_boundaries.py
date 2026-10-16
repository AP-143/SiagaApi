import json
import zipfile

import psycopg
import pytest

from app.boundaries import load_boundaries, load_boundaries_from_zip
from tests import fixtures


@pytest.fixture
def loaded(client, database_url):
    with psycopg.connect(database_url) as conn:
        load_boundaries(conn, fixtures.ALL_PROVINCES, fixtures.ALL_REGENCIES)
    return client


def test_lists_only_the_five_kalimantan_provinces(loaded):
    response = loaded.get("/provinces")

    assert response.status_code == 200
    assert response.json() == [
        {"code": "ID61", "name": "Kalimantan Barat"},
        {"code": "ID63", "name": "Kalimantan Selatan"},
        {"code": "ID62", "name": "Kalimantan Tengah"},
        {"code": "ID64", "name": "Kalimantan Timur"},
        {"code": "ID65", "name": "Kalimantan Utara"},
    ]


def test_lists_the_regencies_of_a_province(loaded):
    response = loaded.get("/provinces/ID61/regencies")

    assert response.status_code == 200
    assert response.json() == [
        {"code": "ID6171", "name": "Pontianak"},
        {"code": "ID6101", "name": "Sambas"},
    ]


def test_regencies_of_a_province_exclude_other_provinces(loaded):
    response = loaded.get("/provinces/ID62/regencies")

    assert response.json() == [{"code": "ID6271", "name": "Palangka Raya"}]


def test_unknown_province_is_not_found(loaded):
    assert loaded.get("/provinces/ID99/regencies").status_code == 404


def test_province_outside_kalimantan_is_not_available(loaded):
    assert loaded.get("/provinces/ID32/regencies").status_code == 404


def test_loads_boundaries_from_an_hdx_cod_ab_zip(client, database_url, tmp_path):
    archive = tmp_path / "idn_admin_boundaries.geojson.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "idn_admin1.geojson",
            json.dumps({"type": "FeatureCollection", "features": fixtures.ALL_PROVINCES}),
        )
        zf.writestr(
            "idn_admin2.geojson",
            json.dumps({"type": "FeatureCollection", "features": fixtures.ALL_REGENCIES}),
        )

    with psycopg.connect(database_url) as conn:
        load_boundaries_from_zip(conn, archive)

    assert len(client.get("/provinces").json()) == 5
    assert client.get("/provinces/ID61/regencies").json() == [
        {"code": "ID6171", "name": "Pontianak"},
        {"code": "ID6101", "name": "Sambas"},
    ]


def test_loading_the_same_boundaries_twice_does_not_duplicate_them(loaded, database_url):
    with psycopg.connect(database_url) as conn:
        load_boundaries(conn, fixtures.ALL_PROVINCES, fixtures.ALL_REGENCIES)

    assert len(loaded.get("/provinces").json()) == 5
    assert len(loaded.get("/provinces/ID61/regencies").json()) == 2
