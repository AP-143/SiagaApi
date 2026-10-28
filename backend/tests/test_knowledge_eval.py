"""An evaluation of the chat against the REAL reviewed documents in backend/knowledge.

Retrieval is deterministic (no language model), so the evaluation is an ordinary test: a list of
questions people might plausibly ask, each with the passage that should answer it, plus questions
that must be turned away because the documents do not cover them. It protects two things: that the
documents answer what they claim to, and that the chat says "not in our sources" instead of
reaching for a loosely related passage.

When you add or reword a document, add the questions it should now answer. A question that is
plausible but cannot be answered yet (a synonym the documents never use) should be written down here
as a strict xfail, so that fixing it is noticed rather than silently forgotten.
"""

import pytest
from fastapi.testclient import TestClient

from app.config import DEFAULT_KNOWLEDGE_DIR
from app.main import create_app
from tests.conftest import NOW


@pytest.fixture
def real_knowledge(database_url, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("KNOWLEDGE_DIR", str(DEFAULT_KNOWLEDGE_DIR))
    # The evaluation asks far more than the per-client chat limit allows in a minute.
    with TestClient(create_app(clock=lambda: NOW, chat_rate_limit_per_minute=10_000)) as client:
        yield client


def ask(client, message):
    return client.post("/chat", json={"message": message}).json()


# (question, heading of the passage that must answer it)
ANSWERABLE = [
    # what a hotspot is
    ("apa itu hotspot?", "Apa itu titik api (hotspot)?"),
    ("Apa itu titik api?", "Apa itu titik api (hotspot)?"),
    ("titik panas itu apa sih?", "Apa itu titik api (hotspot)?"),
    ("jelaskan apa itu hotspot", "Apa itu titik api (hotspot)?"),
    ("apakah titik api sama dengan kebakaran?", "Apakah titik api (hotspot) sama dengan kebakaran?"),
    ("apakah hotspot berarti pasti ada kebakaran?", "Apakah titik api (hotspot) sama dengan kebakaran?"),
    ("seberapa akurat lokasi titik api?", "Seberapa akurat lokasi titik api?"),
    ("apakah lokasi titik api tepat?", "Seberapa akurat lokasi titik api?"),
    ("seberapa besar piksel satelit VIIRS?", "Seberapa akurat lokasi titik api?"),
    ("mengapa satelit tidak mendeteksi api?", "Mengapa api bisa tidak terdeteksi satelit?"),
    ("apakah awan bisa menutupi api dari satelit?", "Mengapa api bisa tidak terdeteksi satelit?"),
    ("seberapa sering data diperbarui?", "Seberapa sering data titik api diperbarui?"),
    ("satelit lewat berapa kali sehari?", "Seberapa sering data titik api diperbarui?"),
    # confidence
    ("apa arti confidence?", "Apa arti tingkat kepercayaan (confidence) titik api?"),
    ("apa arti kepercayaan rendah?", "Apa arti tingkat kepercayaan (confidence) titik api?"),
    ("apa itu sun glint?", "Apa arti tingkat kepercayaan (confidence) titik api?"),
    # peat
    ("kenapa gambut sulit dipadamkan?", "Mengapa kebakaran gambut sulit dipadamkan?"),
    ("mengapa kebakaran gambut berlangsung berhari-hari?", "Mengapa kebakaran gambut sulit dipadamkan?"),
    ("kenapa gambut mudah terbakar?", "Mengapa lahan gambut mudah terbakar saat kemarau?"),
    ("mengapa gambut terbakar saat kemarau?", "Mengapa lahan gambut mudah terbakar saat kemarau?"),
    ("kenapa kebakaran gambut menimbulkan asap tebal?", "Mengapa kebakaran gambut menghasilkan asap tebal?"),
    ("kenapa titik api di gambut diberi perhatian khusus?", "Mengapa titik api di lahan gambut mendapat perhatian khusus di SiagaApi?"),
    # reading the map
    ("apa arti titik ungu di peta?", "Apa arti warna dan ukuran titik di peta?"),
    ("apa arti warna titik di peta?", "Apa arti warna dan ukuran titik di peta?"),
    ("bagaimana SiagaApi menentukan titik api di lahan gambut?", "Bagaimana SiagaApi menentukan sebuah titik api berada di lahan gambut?"),
    ("dari mana data peta berasal?", "Dari mana data di peta SiagaApi berasal?"),
    ("kenapa titik berkepercayaan rendah disembunyikan?", "Mengapa titik api berkepercayaan rendah disembunyikan?"),
    ("setelah berapa lama banner peringatan muncul di peta?", "Setelah berapa lama banner peringatan di peta muncul?"),
    ("apa arti jumlah titik api per kabupaten?", "Apa arti jumlah titik api per kabupaten/kota?"),
    ("jam di peta pakai zona waktu apa?", "Jam di peta memakai zona waktu apa?"),
    ("seberapa tepat garis batas wilayah di peta?", "Seberapa tepat garis batas wilayah di peta?"),
    # what to do
    ("apa yang harus dilakukan jika melihat kebakaran?", "Apa yang harus saya lakukan jika melihat kebakaran atau titik api di dekat saya?"),
    ("siapa yang harus dihubungi kalau ada kebakaran?", "Apa yang harus saya lakukan jika melihat kebakaran atau titik api di dekat saya?"),
    ("apakah SiagaApi bisa memastikan ada kebakaran di lokasi saya?", "Apakah SiagaApi bisa memastikan ada kebakaran di lokasi saya?"),
    ("apakah ada panduan kesehatan untuk asap?", "Apakah ada panduan kesehatan untuk asap kebakaran di SiagaApi?"),
    ("siapa yang memadamkan kebakaran hutan dan lahan?", "Siapa yang memadamkan kebakaran hutan dan lahan?"),
    # smoke and health: Kemenkes
    ("apa yang harus dilakukan di rumah saat kabut asap?", "Apa yang sebaiknya saya lakukan di rumah saat ada kabut asap?"),
    ("bagaimana melindungi diri dari kabut asap?", "Apa yang sebaiknya saya lakukan di rumah saat ada kabut asap?"),
    ("bagaimana membuat ruang aman asap di rumah?", "Bagaimana membuat ruang aman asap di rumah?"),
    ("masker apa yang dipakai saat keluar rumah di tengah asap?", "Masker apa yang dianjurkan saat terpaksa keluar rumah di tengah asap?"),
    ("apakah masker n95 paling efektif untuk asap?", "Masker apa yang dianjurkan saat terpaksa keluar rumah di tengah asap?"),
    ("bolehkah anak memakai masker n95?", "Bagaimana dengan anak kecil dan ibu hamil saat ada kabut asap?"),
    ("bagaimana bayi dan ibu hamil saat kabut asap?", "Bagaimana dengan anak kecil dan ibu hamil saat ada kabut asap?"),
    ("apa itu rumah oksigen?", "Apa itu rumah oksigen dan siapa yang diutamakan?"),
    ("mengapa asap kebakaran hutan dan lahan berbahaya bagi kesehatan?", "Mengapa asap kebakaran hutan dan lahan berbahaya bagi kesehatan?"),
    ("apa itu ispa akibat asap karhutla?", "Mengapa asap kebakaran hutan dan lahan berbahaya bagi kesehatan?"),
    # smoke and health: WHO
    ("apa risiko kesehatan dari asap kebakaran hutan?", "Apa risiko kesehatan dari asap kebakaran hutan?"),
    ("siapa yang paling berisiko terkena dampak asap?", "Apa risiko kesehatan dari asap kebakaran hutan?"),
    ("bagaimana melindungi kesehatan saat ada kebakaran di sekitar saya?", "Bagaimana melindungi kesehatan saat ada kebakaran di sekitar saya?"),
    ("kapan saya perlu ke dokter karena asap kebakaran?", "Kapan saya perlu mencari bantuan medis karena asap kebakaran?"),
]

# Questions the documents do not cover: the right answer is "not in our sources".
UNANSWERABLE = [
    "bagaimana cuaca besok?",
    "kapan musim hujan dimulai?",
    "siapa presiden indonesia?",
    "berapa harga bensin hari ini?",
    "apa itu banjir?",
    "bagaimana cara memadamkan api di rumah?",
    "obat apa yang bagus untuk batuk akibat asap?",
    "apakah sekolah libur karena asap?",
    "berapa luas hutan kalimantan?",
    "bagaimana cara menanam padi?",
    "apa itu hotspot di Mars?",
    "kenapa harga cabai naik?",
    "siapa penemu satelit?",
    "bagaimana cara membuat peta?",
    # health questions the documents do not answer: no personal or medical advice
    "berapa nilai ISPU hari ini?",
    "berapa harga masker n95?",
    "apakah bayi saya perlu oksigen?",
    "apakah saya terkena ISPA?",
    "berapa dosis obat batuk untuk anak?",
]

# Plausible questions that the documents cannot answer yet but that are still answered, wrongly, by the closest
# general passage. Strict, so that fixing one is noticed.
KNOWN_FALSE_ANSWERS = [
    pytest.param("apakah rumah saya aman dari asap?", id="own house: answered with how to make a safe room"),
]

@pytest.mark.parametrize("question, heading", ANSWERABLE)
def test_a_covered_question_is_answered_by_the_right_passage(real_knowledge, question, heading):
    reply = ask(real_knowledge, question)

    assert reply["kind"] == "knowledge", reply["answer"]
    assert reply["data"]["sources"][0]["heading"] == heading


@pytest.mark.xfail(strict=True, reason="word overlap alone cannot tell a question about the person's own situation from the passage it resembles")
@pytest.mark.parametrize("question", KNOWN_FALSE_ANSWERS)
def test_known_false_answers(real_knowledge, question):
    assert ask(real_knowledge, question)["kind"] == "unsupported"


@pytest.mark.parametrize("question", UNANSWERABLE)
def test_an_uncovered_question_is_turned_away(real_knowledge, question):
    reply = ask(real_knowledge, question)

    assert reply["kind"] == "unsupported", reply["answer"]


def test_every_passage_in_the_real_documents_is_reachable_by_its_own_heading(real_knowledge):
    # A passage nobody can find by asking its own title is a passage that was written for nothing.
    import psycopg
    import os

    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        headings = [row[0] for row in conn.execute("SELECT heading FROM knowledge_chunks ORDER BY id")]
    assert len(headings) >= 20

    def answered_by(question):
        reply = ask(real_knowledge, question)
        return reply["data"]["sources"][0]["heading"] if reply["kind"] == "knowledge" else reply["kind"]

    missed = {h: answered_by(h) for h in headings if answered_by(h) != h}

    assert missed == {}


def test_counting_questions_are_not_taken_for_knowledge_questions(real_knowledge):
    for question in ["berapa titik api di Kalimantan Tengah?", "kabupaten mana yang paling banyak titik apinya?"]:
        assert ask(real_knowledge, question)["kind"] in {"count", "ranking"}


def test_a_question_about_who_does_something_is_never_answered_with_a_count(real_knowledge):
    reply = ask(real_knowledge, "siapa yang memadamkan kebakaran hutan dan lahan?")

    assert reply["kind"] == "knowledge"


# ---- Questions worded with words the documents never use ---------------------------------------
#
# Full-text search cannot find these: they share no stem with the passage. They are answered through
# the meaning of the heading (the embedding search), and only when it is close enough.
SYNONYMS = [
    ("kenapa api di gambut tidak mau padam?", "Mengapa kebakaran gambut sulit dipadamkan?"),
    ("kenapa tanah gambut susah dimatikan apinya?", "Mengapa kebakaran gambut sulit dipadamkan?"),
    ("mengapa asap dari kebakaran gambut begitu pekat?", "Mengapa kebakaran gambut menghasilkan asap tebal?"),
    ("siapa yang bertugas memadamkan api hutan?", "Siapa yang memadamkan kebakaran hutan dan lahan?"),
    (
        "kenapa titik api dengan kepercayaan rendah tidak ditampilkan?",
        "Mengapa titik api berkepercayaan rendah disembunyikan?",
    ),
    ("seberapa sering informasi titik api ter-update?", "Seberapa sering data titik api diperbarui?"),
    (
        "bagaimana cara melindungi diri dari asap kebakaran?",
        "Bagaimana melindungi kesehatan saat ada kebakaran di sekitar saya?",
    ),
]

# Close in subject to a passage, but not something the documents say.
CLOSE_BUT_UNCOVERED = [
    "kapan terakhir kali terjadi kebakaran besar?",
    "bagaimana cara mengobati sesak napas?",
    "apakah masker kain cukup untuk melindungi dari asap?",
    "bagaimana cara daftar jadi relawan?",
    "berapa jumlah penduduk kalimantan?",
]


@pytest.mark.parametrize("question, heading", SYNONYMS)
def test_a_question_worded_with_other_words_finds_the_passage_by_meaning(real_knowledge, question, heading):
    reply = ask(real_knowledge, question)

    assert reply["kind"] == "knowledge", reply["answer"]
    assert reply["data"]["sources"][0]["heading"] == heading


@pytest.mark.parametrize("question", CLOSE_BUT_UNCOVERED)
def test_a_question_close_in_meaning_but_not_covered_is_still_turned_away(real_knowledge, question):
    assert ask(real_knowledge, question)["kind"] == "unsupported"


def test_without_the_embedding_model_the_chat_still_answers_by_words(real_knowledge, monkeypatch):
    from app import knowledge

    def unavailable(texts):
        raise RuntimeError("no embedding model")

    monkeypatch.setattr(knowledge.embeddings, "embed", unavailable)

    reply = ask(real_knowledge, "kenapa gambut sulit dipadamkan?")
    synonym = ask(real_knowledge, "kenapa api di gambut tidak mau padam?")

    assert reply["kind"] == "knowledge"
    assert reply["data"]["sources"][0]["heading"] == "Mengapa kebakaran gambut sulit dipadamkan?"
    assert synonym["kind"] == "unsupported"  # words alone cannot find it, and nothing broke trying
