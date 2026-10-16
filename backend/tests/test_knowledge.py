import psycopg
import pytest
from fastapi.testclient import TestClient

from app.knowledge import KnowledgeError
from app.main import create_app
from tests.conftest import NOW

TITIK_API = """---
title: Tentang titik api
source: Dokumen uji A
url: https://example.org/titik-api
reviewed: 2026-01-02
---

## Apa itu titik api (hotspot)?

Titik api atau hotspot adalah deteksi satelit atas anomali panas. Satu titik mewakili pusat sebuah piksel sekitar 375 meter.

## Seberapa sering data diperbarui?

Satelit melintas dua kali sehari. Data tersedia paling lama tiga jam setelah pengamatan.

## Seberapa akurat lokasi titik api?

Lokasi titik api adalah pusat piksel, belum tentu koordinat api yang sebenarnya.
"""

GAMBUT = """---
title: Gambut dan kebakaran
source: Dokumen uji B
reviewed: 2026-02-03
---

## Mengapa kebakaran gambut sulit dipadamkan?

Api menjalar di bawah permukaan tanah secara lambat dan sulit dideteksi, sehingga bisa berlangsung berhari-hari.
"""

DOCS = {"titik-api.md": TITIK_API, "gambut.md": GAMBUT}


@pytest.fixture
def knowledge_app(database_url, monkeypatch, tmp_path):
    """Start the API over a knowledge folder holding the given documents."""
    started = []

    def make(docs):
        directory = tmp_path / "knowledge"
        directory.mkdir(exist_ok=True)
        for old in directory.glob("*.md"):
            old.unlink()
        for name, text in docs.items():
            (directory / name).write_text(text, encoding="utf-8")
        monkeypatch.setenv("KNOWLEDGE_DIR", str(directory))
        monkeypatch.setenv("DATABASE_URL", database_url)  # the throwaway test database, never the dev one
        client = TestClient(create_app(clock=lambda: NOW))
        client.__enter__()
        started.append(client)
        return client

    yield make
    for client in started:
        client.__exit__(None, None, None)


def ask(client, message):
    response = client.post("/chat", json={"message": message})
    assert response.status_code == 200
    return response.json()


# ---- Answering from the documents ---------------------------------------------------------------


def test_a_question_is_answered_with_the_matching_passage_word_for_word(knowledge_app):
    reply = ask(knowledge_app(DOCS), "apa itu hotspot?")

    assert reply["kind"] == "knowledge"
    assert (
        "Titik api atau hotspot adalah deteksi satelit atas anomali panas. "
        "Satu titik mewakili pusat sebuah piksel sekitar 375 meter."
    ) in reply["answer"]


def test_the_answer_names_its_source_and_date(knowledge_app):
    reply = ask(knowledge_app(DOCS), "apa itu hotspot?")

    assert reply["answer"].endswith("Sumber: Tentang titik api (Dokumen uji A), ditinjau 2 Jan 2026.")
    assert reply["data"]["sources"] == [
        {
            "title": "Tentang titik api",
            "source": "Dokumen uji A",
            "url": "https://example.org/titik-api",
            "reviewed": "2026-01-02",
            "heading": "Apa itu titik api (hotspot)?",
        }
    ]


def test_a_source_without_a_link_has_none(knowledge_app):
    reply = ask(knowledge_app(DOCS), "kenapa kebakaran gambut sulit dipadamkan")

    assert reply["data"]["sources"][0]["url"] is None


def test_words_are_matched_by_their_stem_not_their_exact_form(knowledge_app):
    # "dideteksi" in the document, "terdeteksi"/"mendeteksi" in the question; "dipadamkan" vs "memadamkan"
    app = knowledge_app(DOCS)

    assert ask(app, "bagaimana satelit mendeteksi anomali panas?")["kind"] == "knowledge"
    assert ask(app, "kenapa gambut yang terbakar sulit memadamkannya")["kind"] == "knowledge"


def test_the_answer_is_found_from_the_heading_alone(knowledge_app):
    reply = ask(knowledge_app(DOCS), "seberapa sering diperbarui")

    assert reply["data"]["sources"][0]["heading"] == "Seberapa sering data diperbarui?"


def test_other_passages_that_fit_are_offered_as_follow_ups(knowledge_app):
    reply = ask(knowledge_app(DOCS), "apa itu titik api?")

    shown = reply["data"]["sources"][0]["heading"]
    related = reply["data"]["related"]
    assert {shown, *related} == {
        "Apa itu titik api (hotspot)?",
        "Seberapa akurat lokasi titik api?",
    }
    assert shown not in related


# ---- Saying "not in our sources" -----------------------------------------------------------------


@pytest.mark.parametrize(
    "question",
    [
        "bagaimana cuaca besok?",
        "siapa presiden pertama indonesia?",
        "apa itu hotspot di Mars?",  # one term matches, the other does not: not good enough
    ],
)
def test_a_question_the_documents_do_not_cover_is_not_answered(knowledge_app, question):
    reply = ask(knowledge_app(DOCS), question)

    assert reply["kind"] == "unsupported"
    assert "sources" not in reply["data"]
    assert "sumber" in reply["answer"]


def test_without_any_documents_nothing_is_answered_from_knowledge(knowledge_app):
    reply = ask(knowledge_app({}), "apa itu hotspot?")

    assert reply["kind"] == "unsupported"


def test_odd_input_is_just_an_unanswered_question(knowledge_app):
    app = knowledge_app(DOCS)

    for text in ["'; drop table knowledge_chunks; --", "!!! ??? ...", "a | b & c ! d", "\u0000 ‮ rtl"]:
        assert ask(app, text)["kind"] == "unsupported"


def test_the_reply_never_repeats_what_the_user_typed(knowledge_app):
    reply = ask(knowledge_app(DOCS), "apa itu hotspot? <script>alert(1)</script>")

    assert "<script>" not in reply["answer"]


# ---- Data questions are not swallowed -----------------------------------------------------------


def test_counting_questions_still_count_when_documents_mention_the_same_words(knowledge_app):
    reply = ask(knowledge_app(DOCS), "berapa titik api hari ini?")

    assert reply["kind"] == "count"


# ---- The documents themselves --------------------------------------------------------------------


def test_replacing_the_documents_replaces_what_can_be_answered(knowledge_app):
    app = knowledge_app(DOCS)
    assert ask(app, "kenapa kebakaran gambut sulit dipadamkan")["kind"] == "knowledge"

    app = knowledge_app({"titik-api.md": TITIK_API})  # the peat document is gone

    assert ask(app, "kenapa kebakaran gambut sulit dipadamkan")["kind"] == "unsupported"
    assert ask(app, "apa itu hotspot?")["kind"] == "knowledge"


@pytest.mark.parametrize(
    "broken, message",
    [
        ("## Tanpa kepala\n\nIsi.\n", "front matter"),
        ("---\nsource: S\nreviewed: 2026-01-01\n---\n\n## A\n\nIsi.\n", "title"),
        ("---\ntitle: T\nreviewed: 2026-01-01\n---\n\n## A\n\nIsi.\n", "source"),
        ("---\ntitle: T\nsource: S\n---\n\n## A\n\nIsi.\n", "reviewed"),
        ("---\ntitle: T\nsource: S\nreviewed: kemarin\n---\n\n## A\n\nIsi.\n", "reviewed"),
        ("---\ntitle: T\nsource: S\nreviewed: 2026-01-01\nurl: javascript:alert(1)\n---\n\n## A\n\nIsi.\n", "url"),
        ("---\ntitle: T\nsource: S\nreviewed: 2026-01-01\n---\n\n## A\n", "empty"),
        ("---\ntitle: T\nsource: S\nreviewed: 2026-01-01\n---\n\nHanya teks tanpa bagian.\n", "section"),
    ],
)
def test_a_broken_document_stops_the_app_from_starting_and_names_the_problem(
    database_url, monkeypatch, tmp_path, broken, message
):
    (tmp_path / "rusak.md").write_text(broken, encoding="utf-8")
    monkeypatch.setenv("KNOWLEDGE_DIR", str(tmp_path))
    monkeypatch.setenv("DATABASE_URL", database_url)

    with pytest.raises(KnowledgeError) as error:
        with TestClient(create_app(clock=lambda: NOW)):
            pass

    assert "rusak.md" in str(error.value)
    assert message in str(error.value)


def test_a_missing_knowledge_folder_just_means_no_knowledge(database_url, monkeypatch, tmp_path):
    monkeypatch.setenv("KNOWLEDGE_DIR", str(tmp_path / "does-not-exist"))
    monkeypatch.setenv("DATABASE_URL", database_url)

    with TestClient(create_app(clock=lambda: NOW)) as app:
        assert ask(app, "apa itu hotspot?")["kind"] == "unsupported"


def test_reading_the_documents_changes_nothing_but_the_knowledge_table(knowledge_app, database_url):
    app = knowledge_app(DOCS)

    def hotspots():
        with psycopg.connect(database_url) as conn:
            return conn.execute("SELECT count(*) FROM hotspots").fetchone()

    before = hotspots()
    ask(app, "apa itu hotspot?")

    assert hotspots() == before
