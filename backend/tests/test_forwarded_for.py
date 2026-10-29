"""Behind a proxy (Render) every request comes from the proxy's address, so the rate limiter has to read
the client from X-Forwarded-For, but only when told the API sits behind a proxy that fills it in."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from tests.helpers import MutableClock

PROXY = "10.1.2.3"


@pytest.fixture
def clock():
    return MutableClock()


def make_client(database_url, monkeypatch, clock, trust_forwarded_for):
    monkeypatch.setenv("DATABASE_URL", database_url)
    app = create_app(clock=clock, rate_limit_per_minute=3, trust_forwarded_for=trust_forwarded_for)
    return TestClient(app, client=(PROXY, 50000))


def hit(client, forwarded_for=None, path="/provinces"):
    headers = {"X-Forwarded-For": forwarded_for} if forwarded_for is not None else {}
    return client.get(path, headers=headers).status_code


def test_off_by_default_the_header_is_ignored(database_url, monkeypatch, clock):
    with make_client(database_url, monkeypatch, clock, trust_forwarded_for=None) as client:
        for i in range(3):
            hit(client, f"198.51.100.{i}")

        assert hit(client, "198.51.100.99") == 429


def test_switched_on_each_forwarded_client_has_its_own_allowance(database_url, monkeypatch, clock):
    with make_client(database_url, monkeypatch, clock, trust_forwarded_for=True) as client:
        for _ in range(3):
            assert hit(client, "198.51.100.1") == 200
        assert hit(client, "198.51.100.1") == 429

        assert hit(client, "198.51.100.2") == 200


def test_the_right_most_entry_is_the_client_so_a_forged_left_part_gains_nothing(
    database_url, monkeypatch, clock
):
    with make_client(database_url, monkeypatch, clock, trust_forwarded_for=True) as client:
        for i in range(3):
            assert hit(client, f"203.0.113.{i}, 198.51.100.1") == 200

        assert hit(client, "203.0.113.200, 198.51.100.1") == 429


def test_switched_on_with_no_header_the_socket_peer_is_used(database_url, monkeypatch, clock):
    with make_client(database_url, monkeypatch, clock, trust_forwarded_for=True) as client:
        for _ in range(3):
            assert hit(client) == 200

        assert hit(client) == 429
        assert hit(client, "") == 429  # an empty header falls back to the peer as well


def test_the_chat_allowance_follows_the_forwarded_client_too(database_url, monkeypatch, clock):
    monkeypatch.setenv("DATABASE_URL", database_url)
    app = create_app(clock=clock, chat_rate_limit_per_minute=2, trust_forwarded_for=True)
    question = {"message": "Kapan data terakhir diperbarui?"}
    with TestClient(app, client=(PROXY, 50000)) as client:
        first = {"X-Forwarded-For": "198.51.100.1"}
        assert client.post("/chat", json=question, headers=first).status_code == 200
        assert client.post("/chat", json=question, headers=first).status_code == 200
        assert client.post("/chat", json=question, headers=first).status_code == 429

        other = {"X-Forwarded-For": "198.51.100.2"}
        assert client.post("/chat", json=question, headers=other).status_code == 200


def test_the_setting_is_read_from_the_environment(database_url, monkeypatch, clock):
    monkeypatch.setenv("TRUST_FORWARDED_FOR", "true")
    monkeypatch.setenv("DATABASE_URL", database_url)
    app = create_app(clock=clock, rate_limit_per_minute=3)
    with TestClient(app, client=(PROXY, 50000)) as client:
        for _ in range(3):
            assert hit(client, "198.51.100.1") == 200

        assert hit(client, "198.51.100.2") == 200
