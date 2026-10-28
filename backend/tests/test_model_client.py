import logging

import pytest

from app.chat.model import ModelUnavailable
from app.chat.model_http import OpenAICompatibleClient
from tests.fake_model_server import FakeModelServer, completion

KEY = "MODELKEY-SECRET-456"


@pytest.fixture
def server():
    fake = FakeModelServer()
    fake.start()
    yield fake
    fake.stop()


def client_for(server, timeout=5.0, key=KEY):
    return OpenAICompatibleClient(
        base_url=f"{server.url}/v1", model="kecil-3b", api_key=key, timeout_seconds=timeout
    )


def test_sends_a_chat_request_in_the_openai_format_and_returns_the_text(server):
    server.respond(completion("jawaban model"))

    text = client_for(server).complete("Instruksi tetap.", "Pertanyaan?")

    assert text == "jawaban model"
    (request,) = server.requests
    assert request["path"] == "/v1/chat/completions"
    assert request["headers"]["authorization"] == f"Bearer {KEY}"
    assert request["json"]["model"] == "kecil-3b"
    assert request["json"]["temperature"] == 0  # structured answers should not vary from one ask to the next
    assert request["json"]["messages"] == [
        {"role": "system", "content": "Instruksi tetap."},
        {"role": "user", "content": "Pertanyaan?"},
    ]


@pytest.mark.parametrize(
    ("status", "body"),
    [
        (500, "boom"),
        (429, '{"error": "rate limited"}'),
        (200, "not json at all"),
        (200, "{}"),
        (200, '{"choices": []}'),
        (200, '{"choices": [{"message": {"content": null}}]}'),
        (200, '{"choices": [{"message": {"content": ["a"]}}]}'),
    ],
)
def test_an_unusable_response_is_a_clear_failure_not_a_crash(server, status, body):
    server.respond(body, status=status)

    with pytest.raises(ModelUnavailable):
        client_for(server).complete("s", "u")


def test_a_model_that_is_too_slow_is_a_clear_failure(server):
    server.delay_seconds = 1.0

    with pytest.raises(ModelUnavailable):
        client_for(server, timeout=0.2).complete("s", "u")


def test_a_model_that_cannot_be_reached_is_a_clear_failure(server):
    client = client_for(server)
    server.stop()

    with pytest.raises(ModelUnavailable):
        client.complete("s", "u")


def test_the_key_never_shows_up_in_an_error_a_repr_or_a_log_line(server, caplog):
    server.respond("boom", status=500)
    client = client_for(server)

    with caplog.at_level(logging.DEBUG), pytest.raises(ModelUnavailable) as failure:
        client.complete("s", "u")

    assert KEY not in str(failure.value)
    assert KEY not in repr(client)
    assert KEY not in caplog.text


def test_a_server_that_needs_no_key_gets_no_authorization_header(server):
    server.respond(completion("jawaban model"))

    text = client_for(server, key="").complete("s", "u")

    assert text == "jawaban model"
    assert "authorization" not in server.requests[0]["headers"]
