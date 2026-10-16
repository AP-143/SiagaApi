"""Answer wording. Every number in an answer is handed in from a database result; nothing here
computes, estimates or recalls one."""

from datetime import date, datetime, timedelta, timezone

from app.chat.places import Area
from app.chat.understanding import SUGGESTIONS
from app.knowledge import Passage

WIB = timezone(timedelta(hours=7))  # Indonesia West Time has no daylight saving
MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

WINDOW_TEXT = {"24h": "24 jam", "48h": "48 jam", "7d": "7 hari"}

CAVEAT = "Ini deteksi satelit, belum tentu kebakaran yang sudah terkonfirmasi."

MAX_RANKED = 5


def number(value: int) -> str:
    """1234 becomes "1.234", the way Indonesians write it."""
    return f"{value:,}".replace(",", ".")


def format_wib(moment: datetime) -> str:
    local = moment.astimezone(WIB)
    return f"{local.day} {MONTHS[local.month - 1]} {local.year}, {local:%H.%M} WIB"


def iso_utc(moment: datetime | None) -> str | None:
    return None if moment is None else moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def freshness_sentence(last_updated: datetime | None, stale: bool) -> str:
    if last_updated is None:
        return "Data belum pernah diperbarui, jadi angka ini mungkin kosong."
    sentence = f"Data terakhir diperbarui {format_wib(last_updated)}."
    if stale:
        sentence += " Peringatan: data mungkin usang, jadi angka terbaru bisa berbeda."
    return sentence


def area_text(area: Area | None) -> str:
    if area is None:
        return "Kalimantan"
    return f"Provinsi {area.name}" if area.type == "province" else area.name


def area_data(area: Area | None) -> dict:
    return {"type": "region", "name": "Kalimantan"} if area is None else area.as_data()


def count_reply(
    *,
    count: int,
    peat_count: int | None,
    area: Area | None,
    window: str,
    peat_only: bool,
    include_low: bool,
    last_updated: datetime | None,
    stale: bool,
) -> dict:
    where = f"di lahan gambut di {area_text(area)}" if peat_only else f"di {area_text(area)}"
    parts = [f"Dalam {WINDOW_TEXT[window]} terakhir ada {number(count)} titik api {where}."]
    if peat_count is not None and not peat_only:
        parts.append(f"{number(peat_count)} di antaranya di lahan gambut.")
    parts.append(
        "Hitungan ini termasuk deteksi dengan kepercayaan rendah."
        if include_low
        else "Hitungan ini tidak termasuk deteksi dengan kepercayaan rendah."
    )
    parts.append(freshness_sentence(last_updated, stale))
    parts.append(CAVEAT)
    return {
        "kind": "count",
        "answer": " ".join(parts),
        "data": {
            "count": count,
            "peat_count": peat_count,
            "area": area_data(area),
            "window": window,
            "peat_only": peat_only,
            "include_low": include_low,
            "last_updated": iso_utc(last_updated),
            "stale": stale,
        },
    }


def ranking_reply(
    *,
    ranking: list[dict],
    unit: str,
    unassigned: int,
    area: Area | None,
    window: str,
    peat_only: bool,
    include_low: bool,
    last_updated: datetime | None,
    stale: bool,
) -> dict:
    unit_text = "provinsi" if unit == "province" else "kabupaten/kota"
    scope = " di lahan gambut" if peat_only else ""
    shown = ranking[:MAX_RANKED]
    top = f"{MAX_RANKED} teratas " if len(ranking) > MAX_RANKED else ""
    header = (
        f"Peringkat {top}{unit_text} berdasarkan jumlah titik api{scope} di {area_text(area)} "
        f"dalam {WINDOW_TEXT[window]} terakhir:"
    )
    if shown:
        lines = [f"{i}. {row['name']}: {number(row['count'])} titik api" for i, row in enumerate(shown, 1)]
    else:
        lines = ["Tidak ada titik api."]
    parts = [header, *lines]
    if unassigned:
        parts.append(f"Ditambah {number(unassigned)} titik api yang tidak berada di kabupaten/kota mana pun.")
    parts.append(freshness_sentence(last_updated, stale))
    parts.append(CAVEAT)
    return {
        "kind": "ranking",
        "answer": "\n".join(parts),
        "data": {
            "ranking": shown,
            "unit": unit,
            "unassigned": unassigned,
            "area": area_data(area),
            "window": window,
            "peat_only": peat_only,
            "include_low": include_low,
            "last_updated": iso_utc(last_updated),
            "stale": stale,
        },
    }


def freshness_reply(last_updated: datetime | None, stale: bool) -> dict:
    return {
        "kind": "freshness",
        "answer": freshness_sentence(last_updated, stale),
        "data": {"last_updated": iso_utc(last_updated), "stale": stale},
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
    return {
        "kind": "unsupported_window",
        "answer": "Saya hanya bisa menghitung untuk 24 jam, 48 jam, atau 7 hari terakhir. Mau pakai yang mana?",
        "data": {"windows": ["24h", "48h", "7d"]},
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
