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


# Small words people write between the others, and endings that stick to a word ("apinya"). They help
# split a run of letters but are too short to ever be repaired into.
FUNCTION_WORDS = {
    "ada", "api", "itu", "ini", "apa", "di", "ke", "dari", "yang", "dan", "atau", "pada", "untuk", "saya",
    "kita", "kami", "mana", "lalu", "nya", "kah", "sih", "dong", "ya", "ini", "sini", "sana", "bisa",
    "tolong", "mohon", "info", "data", "di", "jam", "terakhir", "hari",
}

MIN_SPLIT_LENGTH = 8  # a shorter unknown word is more likely a typo than a run of words


def segment(token: str, words: set[str]) -> list[str] | None:
    """Split a run of letters into known words, or None when it cannot be done, or only ambiguously.

    The split with the fewest pieces wins, then the one with the longest words; when two different
    splits are equally good none is chosen, because a guess here would read a different question.
    """
    n = len(token)
    longest = max((len(word) for word in words), default=0)
    # best[i] = (pieces, -sum of squared lengths, how many splits are that good (capped at 2), how it ends)
    best: list[tuple[int, int, int, int] | None] = [None] * (n + 1)
    best[0] = (0, 0, 1, 0)
    for end in range(1, n + 1):
        options: list[tuple[int, int, int, int]] = []
        for size in range(1, min(longest, end) + 1):
            start = end - size
            previous = best[start]
            if previous is None or token[start:end] not in words:
                continue
            options.append((previous[0] + 1, previous[1] - size * size, previous[2], start))
        if not options:
            continue
        top = min((pieces, score) for pieces, score, _, _ in options)
        ways = min(2, sum(count for pieces, score, count, _ in options if (pieces, score) == top))
        start = next(start for pieces, score, _, start in options if (pieces, score) == top)
        best[end] = (top[0], top[1], ways, start)
    final = best[n]
    if final is None or final[2] != 1:
        return None
    pieces: list[str] = []
    end = n
    while end > 0:
        start = best[end][3]  # type: ignore[index]
        pieces.append(token[start:end])
        end = start
    return list(reversed(pieces))


def repair_question(text: str, place_words: set[str]) -> Repair:
    """Split runs of letters written without spaces, then fix the spelling of the words.

    `text` is an already normalised question. Only a long token that is not a known word is split, and
    only into known words, so noise stays noise and a normal question is not touched.
    """
    known = RULE_WORDS | FUNCTION_WORDS | place_words
    readings: list[tuple[str, str]] = []
    tokens: list[str] = []
    for token in text.split():
        pieces = None
        if len(token) >= MIN_SPLIT_LENGTH and token.isalpha() and token not in known:
            pieces = segment(token, known)
        if pieces and len(pieces) > 1:
            readings.append((token[:120], " ".join(pieces)[:160]))
            tokens.extend(pieces)
        else:
            tokens.append(token)
    spelled = repair_words(" ".join(tokens), place_words)
    return Repair(spelled.text, [*readings, *spelled.readings])
