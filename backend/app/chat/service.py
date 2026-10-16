from datetime import datetime

import psycopg

from app.chat import answers
from app.chat.places import PlaceIndex
from app.chat.understanding import Question, understand
from app.knowledge import search_knowledge
from app.queries import STALE_AFTER, count_hotspots, hotspot_where, last_ingestion, regency_counts


def _filters(question: Question, now: datetime) -> tuple[str, list]:
    area = question.area
    return hotspot_where(
        now,
        window=question.window,
        province=area.code if area and area.type == "province" else None,
        regency=area.code if area and area.type == "regency" else None,
        min_confidence="low" if question.include_low else "nominal",
        peat_only=question.peat_only,
    )


def _freshness(conn: psycopg.Connection, now: datetime) -> tuple[datetime | None, bool]:
    last_updated = last_ingestion(conn)
    stale = last_updated is None or now - last_updated > STALE_AFTER
    return last_updated, stale


def _count(conn: psycopg.Connection, question: Question, now: datetime) -> dict:
    where, params = _filters(question, now)
    count = count_hotspots(conn, where, params)
    peat_count = None if question.peat_only else count_hotspots(conn, f"{where} AND h.peat_hotspot", params)
    last_updated, stale = _freshness(conn, now)
    return answers.count_reply(
        count=count,
        peat_count=peat_count,
        area=question.area,
        window=question.window,
        peat_only=question.peat_only,
        include_low=question.include_low,
        last_updated=last_updated,
        stale=stale,
    )


def _ranking(conn: psycopg.Connection, question: Question, now: datetime) -> dict:
    where, params = _filters(question, now)
    rows = regency_counts(conn, where, params)
    unassigned = 0
    if question.ranking_unit == "province":
        totals: dict[str, dict] = {}
        for _, _, p_code, p_name, count in rows:
            entry = totals.setdefault(p_code, {"code": p_code, "name": p_name, "count": 0})
            entry["count"] += count
        ranking = sorted(totals.values(), key=lambda e: (-e["count"], e["name"]))
    else:
        ranking = []
        for r_code, r_name, _, p_name, count in rows:
            if r_code is None:
                unassigned += count
            else:
                ranking.append({"code": r_code, "name": r_name, "province": p_name, "count": count})
    last_updated, stale = _freshness(conn, now)
    return answers.ranking_reply(
        ranking=ranking,
        unit=question.ranking_unit,
        unassigned=unassigned,
        area=question.area,
        window=question.window,
        peat_only=question.peat_only,
        include_low=question.include_low,
        last_updated=last_updated,
        stale=stale,
    )


def answer_question(conn: psycopg.Connection, message: str, now: datetime) -> dict:
    """Answer one question from the database. Read-only: nothing here writes."""
    question = understand(message, PlaceIndex.load(conn))
    if question.intent == "count":
        return _count(conn, question, now)
    if question.intent == "ranking":
        return _ranking(conn, question, now)
    if question.intent == "freshness":
        last_updated, stale = _freshness(conn, now)
        return answers.freshness_reply(last_updated, stale)
    if question.intent == "clarify":
        return answers.clarify_reply(question.candidates or [])
    if question.intent == "unknown_place":
        return answers.unknown_place_reply(question.unknown_phrase)
    if question.intent == "unsupported_window":
        return answers.unsupported_window_reply()
    # Not a question about the numbers: it may be one the reviewed documents can answer.
    passages = search_knowledge(conn, message)
    if passages:
        return answers.knowledge_reply(passages)
    return answers.unsupported_reply()
