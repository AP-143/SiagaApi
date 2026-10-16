"""Answer wording. Every number in an answer is handed in from a database result; nothing here
computes, estimates or recalls one."""

from datetime import date, datetime, timedelta, timezone

from app.chat.places import Area
from app.chat.understanding import SUGGESTIONS, RankingUnit, Scope
from app.knowledge import Passage
from app.queries import TIME_WINDOWS, Freshness
from app.timefmt import iso_utc

WIB = timezone(timedelta(hours=7))  # Indonesia West Time has no daylight saving
MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

CAVEAT = "Ini deteksi satelit, belum tentu kebakaran yang sudah terkonfirmasi."

MAX_RANKED = 5


def number(value: int) -> str:
    """1234 becomes "1.234", the way Indonesians write it."""
    return f"{value:,}".replace(",", ".")


def format_wib(moment: datetime) -> str:
    local = moment.astimezone(WIB)
    return f"{local.day} {MONTHS[local.month - 1]} {local.year}, {local:%H.%M} WIB"


def freshness_sentence(freshness: Freshness) -> str:
    if freshness.last_updated is None:
        return "Data belum pernah diperbarui, jadi angka ini mungkin kosong."
    sentence = f"Data terakhir diperbarui {format_wib(freshness.last_updated)}."
    if freshness.stale:
        sentence += " Peringatan: data mungkin usang, jadi angka terbaru bisa berbeda."
    return sentence


def area_text(area: Area | None) -> str:
    if area is None:
        return "Kalimantan"
    return f"Provinsi {area.name}" if area.type == "province" else area.name


def area_data(area: Area | None) -> dict:
    return {"type": "region", "name": "Kalimantan"} if area is None else area.as_data()


def _scope_data(scope: Scope, freshness: Freshness) -> dict:
    """The fields every count and ranking answer carries about what it was counted over."""
    return {
        "area": area_data(scope.area),
        "window": scope.window,
        "peat_only": scope.peat_only,
        "include_low": scope.include_low,
        "last_updated": iso_utc(freshness.last_updated),
        "stale": freshness.stale,
    }


def count_reply(*, count: int, peat_count: int | None, scope: Scope, freshness: Freshness) -> dict:
    where = (
        f"di lahan gambut di {area_text(scope.area)}" if scope.peat_only else f"di {area_text(scope.area)}"
    )
    window = TIME_WINDOWS[scope.window].label
    parts = [f"Dalam {window} terakhir ada {number(count)} titik api {where}."]
    if peat_count is not None and not scope.peat_only:
        parts.append(f"{number(peat_count)} di antaranya di lahan gambut.")
    parts.append(
        "Hitungan ini termasuk deteksi dengan kepercayaan rendah."
        if scope.include_low
        else "Hitungan ini tidak termasuk deteksi dengan kepercayaan rendah."
    )
    parts.append(freshness_sentence(freshness))
    parts.append(CAVEAT)
    return {
        "kind": "count",
        "answer": " ".join(parts),
        "data": {"count": count, "peat_count": peat_count, **_scope_data(scope, freshness)},
    }


def ranking_reply(
    *,
    ranking: list[dict],
    unit: RankingUnit,
    unassigned: int,
    scope: Scope,
    freshness: Freshness,
) -> dict:
    unit_text = "provinsi" if unit is RankingUnit.PROVINCE else "kabupaten/kota"
    in_peat = " di lahan gambut" if scope.peat_only else ""
    shown = ranking[:MAX_RANKED]
    top = f"{MAX_RANKED} teratas " if len(ranking) > MAX_RANKED else ""
    header = (
        f"Peringkat {top}{unit_text} berdasarkan jumlah titik api{in_peat} di {area_text(scope.area)} "
        f"dalam {TIME_WINDOWS[scope.window].label} terakhir:"
    )
    if shown:
        lines = [f"{i}. {row['name']}: {number(row['count'])} titik api" for i, row in enumerate(shown, 1)]
    else:
        lines = ["Tidak ada titik api."]
    parts = [header, *lines]
    if unassigned:
        parts.append(f"Ditambah {number(unassigned)} titik api yang tidak berada di kabupaten/kota mana pun.")
    parts.append(freshness_sentence(freshness))
    parts.append(CAVEAT)
    return {
        "kind": "ranking",
        "answer": "\n".join(parts),
        "data": {
            "ranking": shown,
            "unit": str(unit),
            "unassigned": unassigned,
            **_scope_data(scope, freshness),
        },
    }


def freshness_reply(freshness: Freshness) -> dict:
    return {
        "kind": "freshness",
        "answer": freshness_sentence(freshness),
        "data": {"last_updated": iso_utc(freshness.last_updated), "stale": freshness.stale},
    }


def clarify_reply(candidates: list[Area]) -> dict:
    names = " atau ".join(a.name for a in candidates[:6])
    return {
        "kind": "clarify",
        "answer": f"Maksud Anda yang mana: {names}? Tulis nama lengkapnya supaya saya tidak salah menghitung.",
        "data": {"candidates": [a.as_data() for a in candidates]},
    }


def unknown_place_reply(phrase: str | None) -> dict:
    safe = "".join(ch for ch in (phrase or "") if ch.isalpha() or ch == " ")[:40].strip()
    return {
        "kind": "unknown_place",
        "answer": (
            f"Saya tidak mengenali wilayah \"{safe}\" di Kalimantan. "
            "Saya hanya punya data titik api untuk lima provinsi di Kalimantan "
            "dan kabupaten/kota di dalamnya."
        ),
        "data": {"suggestions": SUGGESTIONS},
    }


def unsupported_window_reply() -> dict:
    labels = [window.label for window in TIME_WINDOWS.values()]
    offered = f"{', '.join(labels[:-1])}, atau {labels[-1]}"
    return {
        "kind": "unsupported_window",
        "answer": f"Saya hanya bisa menghitung untuk {offered} terakhir. Mau pakai yang mana?",
        "data": {"windows": list(TIME_WINDOWS)},
    }


def unsupported_reply() -> dict:
    return {
        "kind": "unsupported",
        "answer": (
            "Maaf, saya tidak menemukannya di sumber yang saya punya, jadi saya belum bisa "
            "menjawabnya. Saya bisa membantu soal jumlah titik api per wilayah, peringkat "
            "kabupaten/kota, kapan data diperbarui, dan penjelasan beberapa istilah."
        ),
        "data": {"suggestions": SUGGESTIONS},
    }


def format_date(day: date) -> str:
    return f"{day.day} {MONTHS[day.month - 1]} {day.year}"


def knowledge_reply(passages: list[Passage]) -> dict:
    """The best passage word for word with its source, and the other fitting passages as follow-ups."""
    best, others = passages[0], passages[1:]
    source_line = f"Sumber: {best.title} ({best.source}), ditinjau {format_date(best.reviewed)}."
    return {
        "kind": "knowledge",
        "answer": f"{best.body}\n\n{source_line}",
        "data": {
            "sources": [
                {
                    "title": best.title,
                    "source": best.source,
                    "url": best.url,
                    "reviewed": best.reviewed.isoformat(),
                    "heading": best.heading,
                }
            ],
            "related": [p.heading for p in others],
        },
    }
