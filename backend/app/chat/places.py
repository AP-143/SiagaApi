"""Finding which Province or Regency a question is about, without ever guessing."""

import re
from dataclasses import dataclass, field

import psycopg

from app.chat.fuzzy import allowed_distance, edit_distance

# Common short forms people use for the five Provinces.
PROVINCE_ALIASES = {
    "ID61": ["kalbar"],
    "ID62": ["kalteng"],
    "ID63": ["kalsel"],
    "ID64": ["kaltim"],
    "ID65": ["kaltara"],
}

# Words that appear in many area names but say nothing about which one is meant.
NON_DISTINCTIVE = {
    "barat", "timur", "utara", "selatan", "tengah", "raya", "kalimantan", "baru",
    "kabupaten", "kota", "kab", "provinsi", "prov",
}

# Words that follow "di" without being a place, so they are never reported as unknown places.
NOT_PLACE_WORDS = {
    "lahan", "gambut", "kalimantan", "seluruh", "semua", "mana", "sini", "sana", "hari", "ini",
    "itu", "antara", "dalam", "atas", "bawah", "area", "wilayah", "daerah", "kepercayaan",
    "rendah", "kabupaten", "kota", "provinsi", "jam", "minggu", "pekan", "bulan", "tahun",
    "kawasan", "tiap", "setiap", "masing", "saya", "kami", "kita",
}

PLACE_AFTER = re.compile(r"\b(?:di|ke|dekat|sekitar|wilayah|daerah|kota|kabupaten|provinsi)\s+([a-z]+(?:\s[a-z]+)?)")


def normalize(text: str) -> str:
    """Lowercase, letters and digits only, single spaces."""
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


GENERIC_PREFIXES = {"kabupaten", "kab", "kota", "provinsi", "prov"}


def _spellings(name: str) -> set[str]:
    """The ways people write a name: in full, without "Kota"/"Kabupaten", and with the words joined.

    A short leftover such as "baru" (from "Kota Baru") is not kept on its own, because it is an
    ordinary word; only the full name and the joined spelling "kotabaru" identify that place.
    """
    spellings = {name}
    stripped = " ".join(word for word in name.split() if word not in GENERIC_PREFIXES)
    if stripped != name and (len(stripped.split()) >= 2 or len(stripped) >= 6):
        spellings.add(stripped)
    for spelling in list(spellings):
        if " " in spelling:
            spellings.add(spelling.replace(" ", ""))
    return spellings


@dataclass(frozen=True)
class Area:
    type: str  # "province" or "regency"
    code: str
    name: str
    province_code: str | None = None

    def as_data(self) -> dict:
        data = {"type": self.type, "code": self.code, "name": self.name}
        if self.province_code is not None:
            data["province_code"] = self.province_code
        return data


@dataclass
class Resolution:
    """kind is "none", "one", "ambiguous" or "unknown"."""

    kind: str
    area: Area | None = None
    candidates: list[Area] = field(default_factory=list)
    unknown_phrase: str | None = None
    # A place that was misspelled: (what was typed, the name it was read as). Set only for a repair.
    read_as: tuple[str, str] | None = None
    # For an unknown place: the nearest known name, offered as "Maksud Anda ...?".
    suggestion: str | None = None


class PlaceIndex:
    def __init__(self, areas: list[Area]):
        self.areas = areas
        self._names: list[tuple[str, Area]] = []
        for area in areas:
            for variant in _spellings(normalize(area.name)):
                self._names.append((variant, area))
        for area in areas:
            for alias in PROVINCE_ALIASES.get(area.code, []):
                self._names.append((alias, area))
        # What a name can start with, for splitting a preposition stuck to it ("dikalimantan utara").
        self._starts = {norm.split()[0] for norm, _ in self._names} | {norm for norm, _ in self._names}
        # Every word of every name, so the word repair can leave a place word to the place repair.
        self.words = {w for norm, _ in self._names for w in [*norm.split(), norm] if len(w) >= 4}
        self._tokens: dict[str, set[Area]] = {}
        for norm, area in self._names:
            for token in norm.split():
                if len(token) >= 4 and token not in NON_DISTINCTIVE:
                    self._tokens.setdefault(token, set()).add(area)

    @classmethod
    def load(cls, conn: psycopg.Connection) -> "PlaceIndex":
        areas = [
            Area("province", code, name)
            for code, name in conn.execute("SELECT code, name FROM provinces").fetchall()
        ]
        areas += [
            Area("regency", code, name, province_code)
            for code, name, province_code in conn.execute(
                "SELECT code, name, province_code FROM regencies"
            ).fetchall()
        ]
        return cls(areas)

    def _split_stuck_prepositions(self, text: str) -> str:
        """"dikalimantan utara" -> "di kalimantan utara", but only when what follows "di"/"ke" begins a
        name we know; "dimana" and "kemarin" are left as they are."""
        words = []
        for word in text.split():
            for preposition in ("di", "ke"):
                rest = word[len(preposition):]
                if word.startswith(preposition) and len(rest) >= 4 and rest in self._starts:
                    words += [preposition, rest]
                    break
            else:
                words.append(word)
        return " ".join(words)

    def _fuzzy(self, text: str) -> Resolution | None:
        """A name written a letter or two wrong ("kalimantan tengh", "seruyann"), read as the one it is
        nearest, or None. Two names equally near is ambiguous: a repair never chooses between them."""
        words = text.split()
        best: int | None = None
        found: dict[Area, str] = {}
        for size in (1, 2, 3):
            for start in range(len(words) - size + 1):
                phrase = " ".join(words[start : start + size])
                if len(phrase) < 5:
                    continue  # a short word is too likely to be an ordinary word
                for norm, area in self._names:
                    if norm[0] != phrase[0] or norm == phrase:
                        continue  # a slip rarely changes the first letter
                    distance = edit_distance(phrase, norm, allowed_distance(len(norm)))
                    if distance is None:
                        continue
                    if best is None or distance < best:
                        best, found = distance, {}
                    if distance == best:
                        found[area] = phrase
        if not found:
            return None
        if len(found) > 1:
            return Resolution("ambiguous", candidates=sorted(found, key=lambda a: a.name))
        area, phrase = next(iter(found.items()))
        return Resolution("one", area=area, read_as=(phrase[:40], area.name))

    def nearest(self, phrase: str) -> str | None:
        """The one known name nearest a phrase we could not read, to offer as a suggestion, or None."""
        phrase = normalize(phrase)
        if len(phrase) < 5:
            return None
        limit = max(2, len(phrase) // 3)
        best: int | None = None
        names: set[str] = set()
        for norm, area in self._names:
            if norm[0] != phrase[0]:
                continue
            distance = edit_distance(phrase, norm, limit)
            if distance is None:
                continue
            if best is None or distance < best:
                best, names = distance, set()
            if distance == best:
                names.add(area.name)
        return next(iter(names)) if len(names) == 1 else None

    def resolve(self, message: str) -> Resolution:
        text = f" {self._split_stuck_prepositions(normalize(message))} "

        # 1. A full name (or alias) written out, preferring the longest one.
        found = {}
        for norm, area in self._names:
            if f" {norm} " in text:
                found[area] = norm
        for area, norm in list(found.items()):
            if any(norm != other and f" {norm} " in f" {other} " for other in found.values()):
                del found[area]  # "Kapuas" is just part of "Kapuas Hulu"
        # A Regency named together with its own Province means the Regency.
        regencies = [a for a in found if a.type == "regency"]
        for province in [a for a in found if a.type == "province"]:
            if any(r.province_code == province.code for r in regencies):
                del found[province]
        if len(found) == 1:
            return Resolution("one", area=next(iter(found)))
        if len(found) > 1:
            return Resolution("ambiguous", candidates=sorted(found, key=lambda a: a.name))

        # 2. A distinctive word from a name ("kutai" for Kutai Barat / Kutai Timur).
        words = [w for w in text.split() if w in self._tokens]
        if words:
            candidates = set.intersection(*(self._tokens[w] for w in words))
            if not candidates:
                candidates = set.union(*(self._tokens[w] for w in words))
            ordered = sorted(candidates, key=lambda a: a.name)
            if len(ordered) == 1:
                return Resolution("one", area=ordered[0])
            return Resolution("ambiguous", candidates=ordered)

        # 3. A name written a letter or two wrong.
        repaired = self._fuzzy(text)
        if repaired is not None:
            return repaired

        # 4. Something that looks like a place, but is not one we know.
        for match in PLACE_AFTER.finditer(text):
            first = match.group(1).split()[0]
            if first not in NOT_PLACE_WORDS and not first.isdigit():
                phrase = match.group(1)
                return Resolution("unknown", unknown_phrase=phrase.title(), suggestion=self.nearest(phrase))
        return Resolution("none")
