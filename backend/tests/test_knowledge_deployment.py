"""A public deployment keeps some documents out (the health ones nobody qualified has reviewed yet) and
may load the documents only when it is seeded, not on every start (a serverless host starts often)."""

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.knowledge import load_knowledge
from app.main import create_app
from tests.conftest import NOW
from tests.test_knowledge import DOCS, GAMBUT, TITIK_API


@pytest.fixture
def folder(tmp_path):
    directory = tmp_path / "knowledge"
    directory.mkdir()
    for name, text in DOCS.items():
        (directory / name).write_text(text, encoding="utf-8")
    return directory


def stored_files(url):
    with psycopg.connect(url) as conn:
        rows = conn.execute("SELECT DISTINCT doc_file FROM knowledge_chunks ORDER BY 1").fetchall()
    return [row[0] for row in rows]


def start(database_url, monkeypatch, folder, **env):
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("KNOWLEDGE_DIR", str(folder))
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    client = TestClient(create_app(clock=lambda: NOW))
    client.__enter__()
    return client


def test_an_excluded_document_is_never_stored(database_url, monkeypatch, folder):
    client = start(database_url, monkeypatch, folder, KNOWLEDGE_EXCLUDE="gambut.md")
    try:
        assert stored_files(database_url) == ["titik-api.md"]
    finally:
        client.__exit__(None, None, None)


def test_a_question_about_an_excluded_document_is_not_answered(database_url, monkeypatch, folder):
    client = start(database_url, monkeypatch, folder, KNOWLEDGE_EXCLUDE="gambut.md")
    try:
        reply = client.post("/chat", json={"message": "Mengapa kebakaran gambut sulit dipadamkan?"}).json()

        assert reply["kind"] != "knowledge"
        assert "Api menjalar di bawah permukaan" not in reply["answer"]
    finally:
        client.__exit__(None, None, None)


def test_several_names_can_be_excluded_with_spaces(database_url, monkeypatch, folder):
    client = start(database_url, monkeypatch, folder, KNOWLEDGE_EXCLUDE=" gambut.md , titik-api.md ")
    try:
        assert stored_files(database_url) == []
    finally:
        client.__exit__(None, None, None)


def test_a_broken_excluded_document_does_not_stop_the_start(database_url, monkeypatch, folder):
    (folder / "belum-ditinjau.md").write_text("not a document at all", encoding="utf-8")
    client = start(database_url, monkeypatch, folder, KNOWLEDGE_EXCLUDE="belum-ditinjau.md")
    try:
        assert stored_files(database_url) == ["gambut.md", "titik-api.md"]
    finally:
        client.__exit__(None, None, None)


def test_by_default_every_start_loads_the_documents(database_url, monkeypatch, folder):
    client = start(database_url, monkeypatch, folder)
    try:
        assert stored_files(database_url) == ["gambut.md", "titik-api.md"]
    finally:
        client.__exit__(None, None, None)


def test_with_the_reload_off_a_start_leaves_the_stored_documents_alone(database_url, monkeypatch, folder):
    with psycopg.connect(database_url) as conn:
        load_knowledge(conn, folder, exclude=("gambut.md",))
    (folder / "gambut.md").write_text(GAMBUT, encoding="utf-8")

    client = start(database_url, monkeypatch, folder, KNOWLEDGE_RELOAD_ON_START="false")
    try:
        assert stored_files(database_url) == ["titik-api.md"]  # not touched by the start
        reply = client.post("/chat", json={"message": "Seberapa sering data diperbarui?"}).json()
        assert reply["kind"] == "knowledge"
    finally:
        client.__exit__(None, None, None)


def test_with_the_reload_off_the_schema_is_still_made(database_url, monkeypatch, folder):
    client = start(database_url, monkeypatch, folder, KNOWLEDGE_RELOAD_ON_START="false")
    try:
        assert client.get("/health").status_code == 200
        assert stored_files(database_url) == []
    finally:
        client.__exit__(None, None, None)


def test_the_folder_is_unchanged_by_all_of_this(folder):
    assert (folder / "titik-api.md").read_text(encoding="utf-8") == TITIK_API
