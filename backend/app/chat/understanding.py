"""Turning a question into a structured request, with plain rules rather than a language model.

Rules cannot make up an answer: either the question matches something we can compute from the
database, or it is turned away. An LLM can later widen what phrasing is understood, but it would
produce the same structured request, and the numbers would still come from the database.
"""

import re
from dataclasses import dataclass, field
from enum import StrEnum

from app.chat.places import Area, PlaceIndex, Resolution, normalize
from app.queries import TIME_WINDOWS

FRESHNESS = re.compile(r"\b(diperbarui|diperbaharui|pembaruan|update|segar|usang|kedaluwarsa|kadaluarsa)\b")
FREQUENCY = re.compile(r"\b(sering|seberapa|frekuensi|berapa\s+kali|setiap)\b")
HOTSPOT_WORDS = re.compile(r"titik\s+(api|panas)|\bhotspots?\b|\bkarhutla\b|\bkebakaran\b")
RANKING = re.compile(r"terbanyak|paling\s+banyak|tertinggi|teratas|peringkat|ranking|urutan|terparah|paling\s+parah")
# Words that ask for an explanation, wherever they sit: "titik panas itu apa sih?" has no
# explanation word at the start but is still not a request for a number.
# Some of them ("apa arti jumlah titik api...") settle the matter even next to "jumlah"; the weaker
# ones ("bagaimana jumlah titik api di ...") give way to a word asking for a number.
STRONG_EXPLAIN_WORD = re.compile(r"\b(kenapa|mengapa|jelaskan|artinya|arti|maksud)\b")
EXPLAIN_WORD = re.compile(r"\b(apa|apakah|siapa|kapan|bagaimana|gimana|seberapa)\b")
HOW_MANY = re.compile(r"\bberapa\b")
QUANTITY = re.compile(r"\b(berapa|jumlah|banyak)\b")
PEAT = re.compile(r"gambut")
LOW_CONFIDENCE = re.compile(r"kepercayaan\s+rendah|confidence\s+rendah|termasuk\s+(yang\s+)?(rendah|low)")
PROVINCE_WORD = re.compile(r"\bprovinsi\b")

NUMBER_UNIT = re.compile(r"\b(\d+)\s*(jam|hari|minggu|pekan|bulan)\b")
UNIT_HOURS = {"jam": 1, "hari": 24, "minggu": 168, "pekan": 168, "bulan": 720}
WORD_WINDOWS = [
    (re.compile(r"\b(sehari)\b"), 24),
    (re.compile(r"\b(dua\s+hari)\b"), 48),
    (re.compile(r"\b(seminggu|sepekan|tujuh\s+hari)\b"), 168),
]
# Periods the map cannot show, so we refuse them rather than answer a different question.
UNSUPPORTED_PERIOD = re.compile(r"\b(bulan|tahun|kemarin|minggu\s+(ini|lalu)|pekan\s+(ini|lalu))\b")
# Hours to window key, read from the one table of windows.
WINDOW_BY_HOURS = {int(w.delta.total_seconds() // 3600): key for key, w in TIME_WINDOWS.items()}

# The same four questions the web app offers in its greeting (frontend/src/chat.ts, STARTER_QUESTIONS);
# the greeting must work before any answer has come back, so the web app keeps its own copy.
SUGGESTIONS = [
    "Berapa titik api di Kalimantan Tengah hari ini?",
    "Kabupaten mana yang paling banyak titik apinya?",
    "Apa itu titik api (hotspot)?",
    "Kapan data terakhir diperbarui?",
]


class Intent(StrEnum):
    COUNT = "count"
    RANKING = "ranking"
    FRESHNESS = "freshness"
    UNSUPPORTED = "unsupported"
    UNSUPPORTED_WINDOW = "unsupported_window"
    CLARIFY = "clarify"
    UNKNOWN_PLACE = "unknown_place"


class RankingUnit(StrEnum):
    REGENCY = "regency"
    PROVINCE = "province"


@dataclass(frozen=True)
class Scope:
    """What a count or ranking is about: the same four choices the map's filters make."""

    area: Area | None = None
    window: str = "24h"
    peat_only: bool = False
    include_low: bool = False


@dataclass
class Question:
    intent: Intent
    scope: Scope = field(default_factory=Scope)
    candidates: list[Area] | None = None
    unknown_phrase: str | None = None
    ranking_unit: RankingUnit = RankingUnit.REGENCY


def _window(text: str) -> str | None:
    """"24h", "48h" or "7d"; None when the period asked for cannot be answered."""
    if UNSUPPORTED_PERIOD.search(text):
        return None
    hours = None
    for number, unit in NUMBER_UNIT.findall(text):
        hours = int(number) * UNIT_HOURS[unit]
        break
    if hours is None:
        for pattern, value in WORD_WINDOWS:
            if pattern.search(text):
                hours = value
                break
    if hours is None:
        return "24h"  # "now", "today" or nothing said: the default view of the map
    return WINDOW_BY_HOURS.get(hours)


def understand(message: str, places: PlaceIndex) -> Question:
    text = normalize(message)

    # "When was it last updated?" is about the data; "how often is it updated?" is an explanation.
    asks_how_often = bool(FREQUENCY.search(text))
    if not asks_how_often and (
        FRESHNESS.search(text) or ("kapan" in text.split() and "data" in text.split())
    ):
        return Question(Intent.FRESHNESS)

    talks_about_hotspots = bool(HOTSPOT_WORDS.search(text))
    if not talks_about_hotspots:
        return Question(Intent.UNSUPPORTED)
    wants_explanation = (STRONG_EXPLAIN_WORD.search(text) and not HOW_MANY.search(text)) or (
        EXPLAIN_WORD.search(text) and not QUANTITY.search(text)
    )
    if wants_explanation and not RANKING.search(text):
        return Question(Intent.UNSUPPORTED)  # an explanation is wanted; that needs the knowledge base

    window = _window(text)
    if window is None:
        return Question(Intent.UNSUPPORTED_WINDOW)

    resolution: Resolution = places.resolve(message)
    if resolution.kind == "ambiguous":
        return Question(Intent.CLARIFY, candidates=resolution.candidates)
    if resolution.kind == "unknown":
        return Question(Intent.UNKNOWN_PLACE, unknown_phrase=resolution.unknown_phrase)

    scope = Scope(
        area=resolution.area,
        window=window,
        peat_only=bool(PEAT.search(text)),
        include_low=bool(LOW_CONFIDENCE.search(text)),
    )
    if RANKING.search(text) and not (resolution.area and resolution.area.type == "regency"):
        unit = RankingUnit.PROVINCE if PROVINCE_WORD.search(text) else RankingUnit.REGENCY
        return Question(Intent.RANKING, scope=scope, ranking_unit=unit)
    return Question(Intent.COUNT, scope=scope)
