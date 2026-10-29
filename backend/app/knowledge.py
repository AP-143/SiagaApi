"""The reviewed documents the chat may quote, and a search over them.

Retrieval is hybrid. PostgreSQL full-text search with the Indonesian stemmer comes first: free,
offline, and exact about the technical terms these documents use. A search by the meaning of the
headings (a small local embedding model) then adds passages the words alone missed, such as a
question that says "api di gambut tidak mau padam" for "kebakaran gambut sulit dipadamkan". Answers
are the passage itself, word for word, with its source. A passage is offered only when it covers
enough of the question's words, or when its heading is very close in meaning; otherwise the honest
answer is "not in our sources". If the embedding model is not available the search is words only.
"""

import logging
import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import psycopg

from app import embeddings
from app.schema import ensure_schema

logger = logging.getLogger(__name__)

# A heading must be at least this close in meaning (cosine similarity) to the question to be offered
# when the words did not find it. Chosen against the evaluation in tests/test_knowledge_eval.py:
# fitting paraphrases scored 0.85 to 0.96, and the closest question the documents do not answer
# scored 0.80. Retune it against that evaluation, not by feel.
MIN_SIMILARITY = 0.85
# A question with fewer meaningful words than this (stop words do not count) may only make sense as a follow-up.
MIN_MEANINGFUL_WORDS = 3

REQUIRED_FIELDS = ("title", "source", "reviewed")

# A passage must contain at least this share of the question's meaningful words to be offered.
MIN_COVERAGE = 0.7
MAX_PASSAGES = 3


class KnowledgeError(Exception):
    """A knowledge document is malformed. The message names the file and the problem."""


@dataclass(frozen=True)
class Document:
    file: str
    title: str
    source: str
    url: str | None
    reviewed: date
    sections: list[tuple[str, str]]  # (heading, body)
    verbatim: bool = False  # shown only word for word, never reworded by a model


@dataclass(frozen=True)
class Passage:
    title: str
    source: str
    url: str | None
    reviewed: date
    heading: str
    body: str
    coverage: float
    rank: float
    verbatim: bool = False


def _fail(file: str, problem: str) -> KnowledgeError:
    return KnowledgeError(f"{file}: {problem}")


def parse_document(path: Path) -> Document:
    """Read one markdown document: a front matter block, then `## Heading` sections."""
    name = path.name
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0].strip() != "---":
        raise _fail(name, "no front matter (a block between --- lines with title, source, reviewed)")
    try:
        end = next(i for i in range(1, len(lines)) if lines[i].strip() == "---")
    except StopIteration:
        raise _fail(name, "the front matter is never closed with a --- line") from None

    meta: dict[str, str] = {}
    for line in lines[1:end]:
        if line.strip():
            key, _, value = line.partition(":")
            meta[key.strip()] = value.strip()
    for field in REQUIRED_FIELDS:
        if not meta.get(field):
            raise _fail(name, f"missing {field} in the front matter")
    try:
        reviewed = date.fromisoformat(meta["reviewed"])
    except ValueError:
        raise _fail(name, "reviewed must be an ISO date such as 2026-10-16") from None
    url = meta.get("url") or None
    if url and not re.match(r"^https?://\S+$", url):
        raise _fail(name, "url must start with http:// or https://")

    verbatim_text = meta.get("verbatim", "false").lower()
    if verbatim_text not in ("true", "false"):
        raise _fail(name, "verbatim must be true or false")
    verbatim = verbatim_text == "true"

    sections: list[tuple[str, list[str]]] = []
    for line in lines[end + 1 :]:
        if line.startswith("## "):
            sections.append((line[3:].strip(), []))
        elif sections:
            sections[-1][1].append(line)
    if not sections:
        raise _fail(name, "no '## ' section found")
    parsed = []
    for heading, body_lines in sections:
        body = "\n".join(body_lines).strip()
        if not heading or not body:
            raise _fail(name, f"section '{heading}' is empty")
        parsed.append((heading, body))
    return Document(name, meta["title"], meta["source"], url, reviewed, parsed, verbatim)


def load_knowledge(conn: psycopg.Connection, directory: Path | str) -> int:
    """Replace the stored passages with the documents in `directory`; returns the passage count.

    Every document is read and checked before the database is touched, so one broken file can
    never leave half a knowledge base behind. A missing folder simply means no knowledge.
    """
    directory = Path(directory)
    documents = [parse_document(p) for p in sorted(directory.glob("*.md"))] if directory.is_dir() else []
    ensure_schema(conn)
    conn.execute("DELETE FROM knowledge_chunks")
    headings = [heading for doc in documents for heading, _ in doc.sections]
    vectors = _embed_or_none(headings)
    count = 0
    for doc in documents:
        for heading, body in doc.sections:
            conn.execute(
                """
                INSERT INTO knowledge_chunks
                    (doc_file, title, source, url, reviewed, heading, body, heading_embedding, verbatim)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    doc.file, doc.title, doc.source, doc.url, doc.reviewed, heading, body,
                    vectors[count] if vectors else None, doc.verbatim,
                ),
            )
            count += 1
    conn.commit()
    return count


def _embed_or_none(texts: list[str]) -> list[list[float]] | None:
    """Vectors for the texts, or None if there is nothing to embed or no embedding model to do it.

    The chat must keep working by words alone, so a missing model is a warning, not a failure.
    """
    if not texts:
        return None
    try:
        return embeddings.embed(texts)
    except Exception:
        logger.warning("the embedding model is not available: knowledge search is by words only")
        return None


_LEXEME = re.compile(r"^[a-z0-9]+$")

# The Indonesian text-search configuration in PostgreSQL keeps every word, function words included,
# so "apa", "itu" and "di" would count as matches and let an unrelated passage look relevant.
# These are ignored when judging how much of a question a passage covers.
STOPWORDS = frozenset(
    """
    apa apakah siapa kapan mana berapa bagaimana kenapa mengapa dimana
    itu ini tersebut yang dan atau tetapi tapi namun serta juga
    di ke dari pada untuk dengan oleh dalam atas bawah antara hingga sampai
    adalah ada akan bisa dapat harus sudah belum telah sedang masih lebih sangat
    sebuah suatu satu para agar saat jika kalau bila maka lalu setelah sebelum ketika
    karena sehingga seperti secara sebagai
    saya kami kita anda kamu dia mereka nya
    sih dong deh kok kah lah nih tuh saja hanya
    jelas jelaskan tolong mohon beri berikan sebut sebutkan
    akibat tentang mengenai terhadap bagi cara hari sekarang kini terbaru
    """.split()
)


def _question_lexemes(conn: psycopg.Connection, question: str) -> list[str]:
    # Anything that is not a letter or digit (punctuation, control characters, query operators)
    # is dropped, so the text can never act as search syntax.
    cleaned = re.sub(r"[\W_]+", " ", question).strip()
    if not cleaned:
        return []
    (lexemes,) = conn.execute(
        "SELECT tsvector_to_array(to_tsvector('indonesian', %s))", (cleaned,)
    ).fetchone()
    return [lexeme for lexeme in lexemes if _LEXEME.match(lexeme) and lexeme not in STOPWORDS]


def search_knowledge(conn: psycopg.Connection, question: str, limit: int = MAX_PASSAGES) -> list[Passage]:
    """Passages that fit the question, best first: those covering enough of its words, then those
    whose heading means nearly the same. Empty if none do."""
    found = _search_by_words(conn, _question_lexemes(conn, question), limit)
    if len(found) < limit:
        seen = {(p.title, p.heading) for p in found}
        found += [p for p in _search_by_meaning(conn, question) if (p.title, p.heading) not in seen]
    return found[:limit]


# The vocabulary of the loaded documents, with the state of the table it was read from. The chat asks for it
# on many requests and the documents change only when they are reloaded, so it is read again only when the
# table has changed (the API and the loading command are separate processes, so the table is the signal).
_vocabulary: tuple[tuple, frozenset[str]] | None = None


def document_words(conn: psycopg.Connection) -> frozenset[str]:
    """The words (letters only, four or more) of the loaded documents, for reading a misspelled term.

    Character similarity is done here, against this vocabulary, with the same rules as every other
    repair (one nearest word, a tie is no repair), rather than with pg_trgm: no extension or schema step,
    and the same behaviour in tests and in production.
    """
    global _vocabulary
    # Reloading replaces every row, so the newest id, the count and the amount of text change together.
    state = conn.execute(
        "SELECT count(*), coalesce(max(id), 0), coalesce(sum(length(heading) + length(body)), 0) FROM knowledge_chunks"
    ).fetchone()
    cached = _vocabulary
    if cached is not None and cached[0] == state:
        return cached[1]
    words: set[str] = set()
    for heading, body in conn.execute("SELECT heading, body FROM knowledge_chunks"):
        words.update(re.findall(r"[a-z]{4,}", f"{heading} {body}".lower()))
    _vocabulary = (state, frozenset(words))
    return _vocabulary[1]


def is_too_short_to_stand_alone(conn: psycopg.Connection, question: str) -> bool:
    """True for a question with so few meaningful words ("kalau seminggu?", "bagaimana dengan Kalimantan
    Barat?") that it may only make sense as a follow-up, and a passage found for it is a guess."""
    return len(_question_lexemes(conn, question)) < MIN_MEANINGFUL_WORDS


def _search_by_meaning(conn: psycopg.Connection, question: str) -> list[Passage]:
    vectors = _embed_or_none([question])
    if not vectors:
        return []
    rows = conn.execute(
        """
        SELECT title, source, url, reviewed, heading, body, heading_embedding, verbatim
        FROM knowledge_chunks WHERE heading_embedding IS NOT NULL
        """
    ).fetchall()
    asked = vectors[0]
    scored = []
    for title, source, url, reviewed, heading, body, vector, verbatim in rows:
        similarity = sum(a * b for a, b in zip(asked, vector))  # unit vectors: this is the cosine
        if similarity >= MIN_SIMILARITY:
            scored.append(Passage(title, source, url, reviewed, heading, body, similarity, similarity, verbatim))
    scored.sort(key=lambda passage: -passage.rank)
    return scored


def _search_by_words(conn: psycopg.Connection, wanted: list[str], limit: int) -> list[Passage]:
    if not wanted:
        return []
    # The words are already stems, so they are matched as they are ('simple'), not stemmed again.
    query = " | ".join(f"'{lexeme}'" for lexeme in wanted)
    rows = conn.execute(
        """
        SELECT title, source, url, reviewed, heading, body, verbatim,
               tsvector_to_array(tsv), tsvector_to_array(to_tsvector('indonesian', heading)),
               ts_rank_cd(tsv, q)
        FROM knowledge_chunks, to_tsquery('simple', %s) AS q
        WHERE tsv @@ q
        ORDER BY ts_rank_cd(tsv, q) DESC
        LIMIT 25
        """,
        (query,),
    ).fetchall()

    asked = set(wanted)
    scored = []
    for title, source, url, reviewed, heading, body, verbatim, lexemes, heading_lexemes, rank in rows:
        coverage = len(asked & set(lexemes)) / len(asked)
        if coverage < MIN_COVERAGE:
            continue
        # Among passages that cover the question equally well, prefer the one whose title is about
        # the same thing: "what is a hotspot?" should reach the passage titled that, not one that
        # merely mentions hotspots on the way to another point.
        title_words = {w for w in heading_lexemes if w not in STOPWORDS}
        title_overlap = len(asked & title_words) / len(asked | title_words) if title_words else 0.0
        passage = Passage(title, source, url, reviewed, heading, body, coverage, float(rank), verbatim)
        scored.append((-coverage, -title_overlap, -float(rank), len(scored), passage))
    scored.sort(key=lambda item: item[:4])
    return [item[-1] for item in scored][:limit]
