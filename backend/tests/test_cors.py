"""The public frontend (GitHub Pages) and the API (Render) are different origins, so the API names the
origins it allows. With none named it sends no CORS headers at all, as before."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from tests.helpers import MutableClock

PAGES = "https://ap-143.github.io"
ELSEWHERE = "https://evil.example"


@pytest.fixture
def clock():
    return MutableClock()


def make_client(database_url, monkeypatch, clock, origins, **limits):
    monkeypatch.setenv("DATABASE_URL", database_url)
    if origins is None:
        monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)
    else:
        monkeypatch.setenv("CORS_ALLOWED_ORIGINS", origins)
    return TestClient(create_app(clock=clock, **limits), client=("203.0.113.7", 50000))


def test_an_allowed_origin_may_read_the_api(database_url, monkeypatch, clock):
    with make_client(database_url, monkeypatch, clock, PAGES) as client:
        response = client.get("/provinces", headers={"Origin": PAGES})

        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == PAGES
        assert "access-control-allow-credentials" not in response.headers


def test_another_origin_gets_no_cors_headers(database_url, monkeypatch, clock):
    with make_client(database_url, monkeypatch, clock, PAGES) as client:
        response = client.get("/provinces", headers={"Origin": ELSEWHERE})

        assert "access-control-allow-origin" not in response.headers


def test_with_no_origins_named_there_are_no_cors_headers(database_url, monkeypatch, clock):
    with make_client(database_url, monkeypatch, clock, None) as client:
        response = client.get("/provinces", headers={"Origin": PAGES})

        assert "access-control-allow-origin" not in response.headers


def test_several_origins_can_be_named_with_spaces_and_a_trailing_slash(database_url, monkeypatch, clock):
    origins = f" {PAGES}/ , http://localhost:5173 "
    with make_client(database_url, monkeypatch, clock, origins) as client:
        for origin in (PAGES, "http://localhost:5173"):
            response = client.get("/provinces", headers={"Origin": origin})

            assert response.headers["access-control-allow-origin"] == origin


def test_the_chat_preflight_is_answered_for_the_allowed_origin(database_url, monkeypatch, clock):
    with make_client(database_url, monkeypatch, clock, PAGES) as client:
        response = client.options(
            "/chat",
            headers={
                "Origin": PAGES,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )

        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == PAGES
        assert "POST" in response.headers["access-control-allow-methods"]


def test_a_rate_limited_answer_can_still_be_read_by_the_page(database_url, monkeypatch, clock):
    with make_client(database_url, monkeypatch, clock, PAGES, rate_limit_per_minute=1) as client:
        client.get("/provinces", headers={"Origin": PAGES})

        response = client.get("/provinces", headers={"Origin": PAGES})

        assert response.status_code == 429
        assert response.headers["access-control-allow-origin"] == PAGES
        assert "retry-after" in response.headers["access-control-expose-headers"].lower()
