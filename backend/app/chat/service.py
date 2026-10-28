from datetime import datetime

import psycopg

from app import queries
from app.chat import answers
from app.chat.explain import ExplanationCache, grounded_explanation
from app.chat.model import ModelClient, ModelUnavailable
from app.chat.model_intent import question_from_model, rewrite_follow_up
from app.chat.places import PlaceIndex
from app.chat.understanding import Intent, Question, RankingUnit, Scope, asks_for_a_period_the_map_lacks, understand
from app.knowledge import Passage, is_too_short_to_stand_alone, search_knowledge


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


def _explain(
    message: str,
    passages: list[Passage],
    places: PlaceIndex,
    model: ModelClient | None,
    cache: ExplanationCache,
) -> dict:
    """The passages as a reply: reworded by the model when it may and can, else word for word."""
    if model is None:
        return answers.knowledge_reply(passages)
    try:
        grounded = grounded_explanation(model, message, passages, places, cache)
    except ModelUnavailable:
        # The quotation is still a good answer; it only says the model could not help.
        return {**answers.knowledge_reply(passages), "simple_mode": True}
    if grounded is None:
        return answers.knowledge_reply(passages)
    return answers.grounded_reply(grounded.text, grounded.used[0], passages)


def _from_rules_or_documents(
    conn: psycopg.Connection,
    message: str,
    now: datetime,
    places: PlaceIndex,
    model: ModelClient | None,
    cache: ExplanationCache,
) -> dict | None:
    """What the rules and the reviewed documents can answer; the model only words an explanation."""
    reply = _answer_understood(conn, understand(message, places), now)
    if reply is not None:
        return reply
    # Not a question about the numbers: it may be one the reviewed documents can answer.
    passages = search_knowledge(conn, message)
    return _explain(message, passages, places, model, cache) if passages else None


def answer_question(
    conn: psycopg.Connection,
    message: str,
    now: datetime,
    model: ModelClient | None = None,
    history: list[tuple[str, str]] | None = None,
    explanations: ExplanationCache | None = None,
) -> dict:
    """Answer one question from the database. Read-only: nothing here writes.

    `history` is the last few turns the browser sent, as (role, text); it is untrusted and only
    used to rewrite a follow-up when the rules cannot read the question as it stands.
    """
    places = PlaceIndex.load(conn)
    cache = explanations if explanations is not None else ExplanationCache()
    reply = _answer_understood(conn, understand(message, places), now)
    if reply is not None:
        return reply

    # Not a question about the numbers: it may be one the reviewed documents can answer. But after
    # earlier turns a very short question ("bagaimana dengan Kalimantan Barat?") is most likely a
    # follow-up, and a passage that happens to share its few words is a guess, so it is read as one first.
    passages = search_knowledge(conn, message)
    # Only a fragment is read as a follow-up: a complete question about something else must not be bent,
    # with the context of earlier turns, into one that the documents happen to answer.
    follow_up = model is not None and bool(history) and is_too_short_to_stand_alone(conn, message)
    if passages and not follow_up:
        return _explain(message, passages, places, model, cache)
    if model is None:
        return answers.unsupported_reply()

    # The rules and the documents have nothing (or only a guess): the model may know what was meant.
    try:
        if follow_up:
            if asks_for_a_period_the_map_lacks(message):
                return answers.unsupported_window_reply()  # "dan kemarin?": a rewrite could lose the word
            rewritten = rewrite_follow_up(model, message, history)
            if rewritten is None:
                return _explain(message, passages, places, model, cache) if passages else answers.unsupported_reply()
            reply = _from_rules_or_documents(conn, rewritten, now, places, model, cache)
            if reply is not None:
                return reply
            message = rewritten
        proposed = question_from_model(model, message, places)
    except ModelUnavailable:
        # The chat still works without the model; it only says so.
        if passages:
            return {**answers.knowledge_reply(passages), "simple_mode": True}
        fallback = answers.needs_full_question_reply() if history else answers.unsupported_reply()
        return {**fallback, "simple_mode": True}
    if proposed is not None:
        return _answer_understood(conn, proposed, now)
    return answers.unsupported_reply()


def _answer_understood(conn: psycopg.Connection, question: Question, now: datetime) -> dict | None:
    """The reply for a question we know how to answer from the database, else None."""
    match question.intent:
        case Intent.COUNT:
            return _count(conn, question, now)
        case Intent.RANKING:
            return _ranking(conn, question, now)
        case Intent.FRESHNESS:
            return answers.freshness_reply(queries.freshness(conn, now))
        case Intent.GREETING:
            return answers.greeting_reply()
        case Intent.CLARIFY:
            return answers.clarify_reply(question.candidates or [])
        case Intent.UNKNOWN_PLACE:
            return answers.unknown_place_reply(question.unknown_phrase)
        case Intent.UNSUPPORTED_WINDOW:
            return answers.unsupported_window_reply()
    return None
