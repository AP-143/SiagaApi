import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from tests.helpers import MutableClock

QUESTION = {"message": "Kapan data terakhir diperbarui?"}


@pytest.fixture
def clock():
    return MutableClock()


@pytest.fixture
def small_chat_limit(database_url, monkeypatch, clock):
    """An app that allows three chat questions a minute per client, and plenty of map requests."""
    monkeypatch.setenv("DATABASE_URL", database_url)

    def make_client(host="203.0.113.7"):
        app = create_app(clock=clock, chat_rate_limit_per_minute=3)
        return TestClient(app, client=(host, 50000))

    with make_client() as first:
        yield first, make_client


def test_a_client_asking_too_often_gets_a_clear_429(small_chat_limit):
    client, _ = small_chat_limit
    assert [client.post("/chat", json=QUESTION).status_code for _ in range(3)] == [200, 200, 200]

    response = client.post("/chat", json=QUESTION)

    assert response.status_code == 429
    assert "Too many requests" in response.json()["detail"]
    assert int(response.headers["retry-after"]) >= 1


def test_asking_a_lot_does_not_take_away_the_map(small_chat_limit):
    client, _ = small_chat_limit
    for _ in range(5):
        client.post("/chat", json=QUESTION)

    assert client.get("/provinces").status_code == 200
    assert client.get("/hotspots").status_code == 200


def test_using_the_map_a_lot_does_not_take_away_the_chat(database_url, monkeypatch, clock):
    monkeypatch.setenv("DATABASE_URL", database_url)
    app = create_app(clock=clock, rate_limit_per_minute=3, chat_rate_limit_per_minute=3)
    with TestClient(app, client=("203.0.113.7", 50000)) as client:
        for _ in range(5):
            client.get("/provinces")
        assert client.get("/provinces").status_code == 429

        assert client.post("/chat", json=QUESTION).status_code == 200


def test_each_client_has_its_own_chat_allowance(small_chat_limit):
    client, make_client = small_chat_limit
    for _ in range(4):
        client.post("/chat", json=QUESTION)

    with make_client(host="198.51.100.9") as another:
        assert another.post("/chat", json=QUESTION).status_code == 200


def test_the_chat_allowance_comes_back_after_a_minute(small_chat_limit, clock):
    client, _ = small_chat_limit
    for _ in range(4):
        client.post("/chat", json=QUESTION)
    assert client.post("/chat", json=QUESTION).status_code == 429

    clock.advance(seconds=61)

    assert client.post("/chat", json=QUESTION).status_code == 200


def test_a_malformed_question_still_counts_so_junk_cannot_be_used_to_flood(small_chat_limit):
    client, _ = small_chat_limit
    for _ in range(3):
        assert client.post("/chat", json={"message": ""}).status_code == 422

    assert client.post("/chat", json=QUESTION).status_code == 429


def test_spoofed_forwarding_headers_do_not_buy_extra_questions(small_chat_limit):
    client, _ = small_chat_limit
    for i in range(3):
        client.post("/chat", json=QUESTION, headers={"X-Forwarded-For": f"10.0.0.{i}"})

    response = client.post("/chat", json=QUESTION, headers={"X-Forwarded-For": "10.9.9.9"})

    assert response.status_code == 429


def test_by_default_chat_is_limited_far_more_tightly_than_the_map(api):
    chat = [api.post("/chat", json=QUESTION).status_code for _ in range(21)]
    assert chat[:20] == [200] * 20
    assert chat[20] == 429

    # The map's default allowance is an order of magnitude larger; thirty requests are nothing to it.
    assert all(api.get("/provinces").status_code == 200 for _ in range(30))
