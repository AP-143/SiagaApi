import pytest
from fastapi.testclient import TestClient

from app.ingestion import run_ingestion
from app.main import create_app
from tests.conftest import NOW
from tests.fake_firms import csv_row, firms_csv
from tests.helpers import IN_SAMBAS, SECRET_KEY, MutableClock


@pytest.fixture
def clock():
    return MutableClock()


@pytest.fixture
def limited(database_url, monkeypatch, clock):
    """An app that allows only three requests a minute per client."""
    monkeypatch.setenv("DATABASE_URL", database_url)

    def make_client(host="203.0.113.7"):
        return TestClient(
            create_app(clock=clock, rate_limit_per_minute=3), client=(host, 50000)
        )

    with make_client() as first:
        yield first, make_client


def test_a_client_over_the_limit_gets_a_clear_429(limited):
    client, _ = limited
    assert [client.get("/provinces").status_code for _ in range(3)] == [200, 200, 200]

    response = client.get("/provinces")

    assert response.status_code == 429
    assert "Too many requests" in response.json()["detail"]
    assert int(response.headers["retry-after"]) >= 1


def test_the_limit_applies_to_every_public_endpoint_together(limited):
    client, _ = limited
    client.get("/provinces")
    client.get("/hotspots")
    client.get("/hotspots/counts")

    assert client.get("/freshness").status_code == 429


def test_each_client_has_its_own_allowance(limited):
    client, make_client = limited
    for _ in range(4):
        client.get("/provinces")

    with make_client(host="198.51.100.9") as another:
        assert another.get("/provinces").status_code == 200


def test_the_allowance_comes_back_after_a_minute(limited, clock):
    client, _ = limited
    for _ in range(4):
        client.get("/provinces")
    assert client.get("/provinces").status_code == 429

    clock.advance(seconds=61)

    assert client.get("/provinces").status_code == 200


def test_health_checks_are_never_rate_limited(limited):
    client, _ = limited
    for _ in range(10):
        client.get("/provinces")

    assert client.get("/health").status_code == 200


def test_spoofed_forwarding_headers_do_not_buy_extra_requests(limited):
    client, _ = limited
    for i in range(3):
        client.get("/provinces", headers={"X-Forwarded-For": f"10.0.0.{i}"})

    response = client.get("/provinces", headers={"X-Forwarded-For": "10.9.9.9"})

    assert response.status_code == 429


def test_every_documented_operation_is_read_only(api):
    paths = api.get("/openapi.json").json()["paths"]

    writes = {
        (path, method)
        for path, operations in paths.items()
        for method in operations
        if method.lower() not in ("get", "head", "options")
    }

    # The chat is the one POST: the question travels in the body. It reads data and never changes
    # any (see test_asking_never_changes_stored_data in test_chat.py), so it is not a write.
    assert writes == {("/chat", "post")}


@pytest.mark.parametrize("method", ["post", "put", "patch", "delete"])
@pytest.mark.parametrize("path", ["/hotspots", "/hotspots/counts", "/provinces", "/freshness"])
def test_write_requests_are_rejected(api, method, path):
    response = api.request(method.upper(), path)

    assert response.status_code == 405


def test_the_map_key_never_appears_in_any_response(
    api, fake_firms, settings_for, monkeypatch, database_url
):
    monkeypatch.setenv("FIRMS_MAP_KEY", SECRET_KEY)
    fake_firms.respond("VIIRS_SNPP_NRT", firms_csv(csv_row(*IN_SAMBAS, "2026-10-16", 540)))
    run_ingestion(settings_for)
    # A failing run as well, since error paths are where secrets tend to leak
    fake_firms.respond("VIIRS_NOAA20_NRT", "boom", status=500)

    with TestClient(create_app(clock=lambda: NOW)) as fresh_client:
        responses = [
            fresh_client.get(path)
            for path in (
                "/health",
                "/hotspots",
                "/hotspots/counts",
                "/provinces",
                "/provinces/ID61/regencies",
                "/provinces/ID99/regencies",  # 404
                "/hotspots?window=1y",  # 422
                "/freshness",
                "/openapi.json",
                "/does-not-exist",  # 404
            )
        ]
        responses.append(fresh_client.post("/hotspots"))  # 405

    for response in responses:
        assert SECRET_KEY not in response.text
        assert SECRET_KEY not in str(response.headers)
