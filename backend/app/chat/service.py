from datetime import datetime

import psycopg

from app import queries
from app.chat import answers
from app.chat.places import PlaceIndex
from app.chat.understanding import Intent, Question, RankingUnit, Scope, understand
from app.knowledge import search_knowledge


def _filters(scope: Scope, now: datetime) -> tuple[str, list]:
    area = scope.area
    return queries.hotspot_where(
        now,
        window=scope.window,
        province=area.code if area and area.type == "province" else None,
        regency=area.code if area and area.type == "regency" else None,
        min_confidence="low" if scope.include_low else "nominal",
        peat_only=scope.peat_only,
    )


def _count(conn: psycopg.Connection, question: Question, now: datetime) -> dict:
    scope = question.scope
    where, params = _filters(scope, now)
    count = queries.count_hotspots(conn, where, params)
    peat_count = (
        None if scope.peat_only else queries.count_hotspots(conn, f"{where} AND h.peat_hotspot", params)
    )
    return answers.count_reply(
        count=count,
        peat_count=peat_count,
        scope=scope,
        freshness=queries.freshness(conn, now),
    )


def _ranking(conn: psycopg.Connection, question: Question, now: datetime) -> dict:
    where, params = _filters(question.scope, now)
    rows = queries.regency_counts(conn, where, params)
    unassigned = 0
    if question.ranking_unit is RankingUnit.PROVINCE:
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
    return answers.ranking_reply(
        ranking=ranking,
        unit=question.ranking_unit,
        unassigned=unassigned,
        scope=question.scope,
        freshness=queries.freshness(conn, now),
    )


def answer_question(conn: psycopg.Connection, message: str, now: datetime) -> dict:
    """Answer one question from the database. Read-only: nothing here writes."""
    question = understand(message, PlaceIndex.load(conn))
    match question.intent:
        case Intent.COUNT:
            return _count(conn, question, now)
        case Intent.RANKING:
            return _ranking(conn, question, now)
        case Intent.FRESHNESS:
            return answers.freshness_reply(queries.freshness(conn, now))
        case Intent.CLARIFY:
            return answers.clarify_reply(question.candidates or [])
        case Intent.UNKNOWN_PLACE:
            return answers.unknown_place_reply(question.unknown_phrase)
        case Intent.UNSUPPORTED_WINDOW:
            return answers.unsupported_window_reply()
    # Not a question about the numbers: it may be one the reviewed documents can answer.
    passages = search_knowledge(conn, message)
    if passages:
        return answers.knowledge_reply(passages)
    return answers.unsupported_reply()
