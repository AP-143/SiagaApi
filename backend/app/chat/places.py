"""Finding which Province or Regency a question is about, without ever guessing."""

import re
from dataclasses import dataclass, field

import psycopg

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

    def resolve(self, message: str) -> Resolution:
        text = f" {normalize(message)} "

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

        # 3. Something that looks like a place, but is not one we know.
        for match in PLACE_AFTER.finditer(text):
            first = match.group(1).split()[0]
            if first not in NOT_PLACE_WORDS and not first.isdigit():
                return Resolution("unknown", unknown_phrase=match.group(1).title())
        return Resolution("none")
