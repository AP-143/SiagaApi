"""Repairing the spelling of a question before the rules read it, from the chat's own vocabulary only.

A repair never invents anything: a word is replaced only by a word the chat already knows, and only
when exactly one such word is that close. Two equally near words, or none, leave the word as typed.
"""

from dataclasses import dataclass, field

from app.chat.fuzzy import allowed_distance, edit_distance

# Short forms that no edit distance would find. A plain list, easy to extend.
SHORT_FORMS = {
    "brp": "berapa",
    "brpa": "berapa",
    "jml": "jumlah",
    "jmlh": "jumlah",
    "yg": "yang",
    "dgn": "dengan",
    "dlm": "dalam",
    "tdk": "tidak",
    "sdh": "sudah",
    "kpn": "kapan",
    "hri": "hari",
    "krn": "karena",
    "titk": "titik",
    "bgmn": "bagaimana",
    "gmn": "gimana",
}

# The words the understanding rules look for (understanding.py), so a slip in one of them is read.
RULE_WORDS = {
    "berapa", "jumlah", "banyak", "titik", "panas", "hotspot", "hotspots", "karhutla", "kebakaran",
    "terbanyak", "tertinggi", "teratas", "peringkat", "ranking", "urutan", "terparah", "paling", "parah",
    "diperbarui", "diperbaharui", "pembaruan", "update", "segar", "usang", "kedaluwarsa", "kadaluarsa",
    "kapan", "terakhir", "kemarin", "gambut", "kepercayaan", "rendah", "provinsi", "kabupaten", "sehari",
    "seminggu", "sepekan", "kenapa", "mengapa", "jelaskan", "artinya", "maksud", "apakah", "siapa",
    "bagaimana", "gimana", "seberapa", "frekuensi", "setiap", "wilayah", "daerah", "terdeteksi", "dengan",
    "dalam", "hari", "minggu", "pekan", "bulan", "tahun", "lahan", "satelit", "deteksi",
}

MIN_REPAIRABLE = 5  # a shorter word is only changed through the table of short forms


@dataclass
class Repair:
    text: str
    # (what was typed, what it was read as), one per repaired word, in the order they appear.
    readings: list[tuple[str, str]] = field(default_factory=list)


def _nearest(word: str, vocabulary: dict[str, str]) -> str | None:
    """The one vocabulary word within the allowed distance of `word`, or None (none, or a tie)."""
    best: int | None = None
    found: set[str] = set()
    for candidate in vocabulary:
        if candidate[0] != word[0]:
            continue  # a slip rarely changes the first letter
        distance = edit_distance(word, candidate, allowed_distance(len(candidate)))
        if distance is None:
            continue
        if best is None or distance < best:
            best, found = distance, set()
        if distance == best:
            found.add(candidate)
    return next(iter(found)) if len(found) == 1 else None


def repair_words(text: str, place_words: set[str]) -> Repair:
    """Fix the spelling of the words of an already normalised question.

    `place_words` are the words of the known place names. A word nearest one of those is left alone,
    because the place repair reads it, and a word that is already a place word is never changed.
    """
    vocabulary = {word: "rule" for word in RULE_WORDS}
    for word in place_words:
        vocabulary.setdefault(word, "place")
    words: list[str] = []
    typed: list[str] = []
    read: list[str] = []
    for word in text.split():
        replacement = SHORT_FORMS.get(word)
        if replacement is None and len(word) >= MIN_REPAIRABLE and word not in vocabulary and word.isalpha():
            candidate = _nearest(word, vocabulary)
            if candidate is not None and vocabulary[candidate] == "rule":
                replacement = candidate
        if replacement is not None and replacement != word:
            typed.append(word)
            read.append(replacement)
            words.append(replacement)
        else:
            words.append(word)
    readings = [(" ".join(typed)[:60], " ".join(read)[:60])] if typed else []
    return Repair(" ".join(words), readings)
