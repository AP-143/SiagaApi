"""The reviewed documents the chat may quote, and a search over them.

Retrieval is plain PostgreSQL full-text search with the Indonesian stemmer: free, offline, and
exact about the technical terms these documents use. Answers are the passage itself, word for
word, with its source; no model rewrites anything. A passage is offered only when it covers enough
of the question's words, otherwise the honest answer is "not in our sources".
"""

import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import psycopg

from app.schema import ensure_schema

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
    return Document(name, meta["title"], meta["source"], url, reviewed, parsed)


def load_knowledge(conn: psycopg.Connection, directory: Path | str) -> int:
    """Replace the stored passages with the documents in `directory`; returns the passage count.

    Every document is read and checked before the database is touched, so one broken file can
    never leave half a knowledge base behind. A missing folder simply means no knowledge.
    """
    directory = Path(directory)
    documents = [parse_document(p) for p in sorted(directory.glob("*.md"))] if directory.is_dir() else []
    ensure_schema(conn)
    conn.execute("DELETE FROM knowledge_chunks")
    count = 0
    for doc in documents:
        for heading, body in doc.sections:
            conn.execute(
                """
                INSERT INTO knowledge_chunks (doc_file, title, source, url, reviewed, heading, body)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (doc.file, doc.title, doc.source, doc.url, doc.reviewed, heading, body),
            )
            count += 1
    conn.commit()
    return count


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
    sih dong deh kok kah lah nih tuh
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
    """Passages that cover enough of the question's words, best first. Empty if none do."""
    wanted = _question_lexemes(conn, question)
    if not wanted:
        return []
    # The words are already stems, so they are matched as they are ('simple'), not stemmed again.
    query = " | ".join(f"'{lexeme}'" for lexeme in wanted)
    rows = conn.execute(
        """
        SELECT title, source, url, reviewed, heading, body,
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
    for title, source, url, reviewed, heading, body, lexemes, heading_lexemes, rank in rows:
        coverage = len(asked & set(lexemes)) / len(asked)
        if coverage < MIN_COVERAGE:
            continue
        # Among passages that cover the question equally well, prefer the one whose title is about
        # the same thing: "what is a hotspot?" should reach the passage titled that, not one that
        # merely mentions hotspots on the way to another point.
        title_words = {w for w in heading_lexemes if w not in STOPWORDS}
        title_overlap = len(asked & title_words) / len(asked | title_words) if title_words else 0.0
        passage = Passage(title, source, url, reviewed, heading, body, coverage, float(rank))
        scored.append((-coverage, -title_overlap, -float(rank), len(scored), passage))
    scored.sort(key=lambda item: item[:4])
    return [item[-1] for item in scored][:limit]
