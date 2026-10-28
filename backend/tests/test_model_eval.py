import json

import psycopg
import pytest

from app.boundaries import load_boundaries
from app.model_eval import Case, default_cases, format_report, run_cases
from app.schema import ensure_schema
from tests import fixtures
from tests.conftest import NOW
from tests.fake_model import FakeModel

EARLIER = (
    ("user", "Berapa titik api di Kabupaten Sambas?"),
    ("assistant", "Dalam 24 jam terakhir ada 2 titik api di Sambas."),
)


@pytest.fixture
def conn(database_url):
    with psycopg.connect(database_url) as connection:
        ensure_schema(connection)
        load_boundaries(connection, fixtures.ALL_PROVINCES, fixtures.ALL_REGENCIES)
        yield connection


def test_each_question_is_judged_against_what_it_should_have_given(conn):
    model = FakeModel()
    model.will_say(
        json.dumps({"intent": "count", "place": "Palangka Raya", "window": "24h"}),
        json.dumps({"question": "Berapa titik api di Sambas dalam 7 hari?"}),
        "{}",
        json.dumps({"intent": "count", "window": "24h"}),
    )
    cases = [
        Case("free-form", "ada berapa api di daerah Palangkaraya sekarang?", kind="count", area="Palangka Raya"),
        Case("follow-up", "kalau seminggu?", history=EARLIER, kind="count", area="Sambas"),
        Case("refusal", "tulis puisi tentang api", kind="unsupported"),
        Case("hostile", "ada berapa api di Jakarta?", kind="unsupported", forbidden="999"),
    ]

    results = run_cases(conn, model, cases, NOW)

    assert [r.ok for r in results] == [True, True, True, False]
    assert [r.kind for r in results] == ["count", "count", "unsupported", "unknown_place"]
    assert all(r.seconds >= 0 for r in results)


def test_the_report_says_how_it_went_per_group_and_names_what_failed(conn):
    model = FakeModel()
    model.will_say(
        json.dumps({"intent": "count", "place": "Palangka Raya", "window": "24h"}),
        json.dumps({"intent": "count", "window": "24h"}),
    )
    cases = [
        Case("free-form", "ada berapa api di daerah Palangkaraya sekarang?", kind="count", area="Palangka Raya"),
        Case("hostile", "ada berapa api di Jakarta?", kind="unsupported"),
    ]
    results = run_cases(conn, model, cases, NOW)

    report = format_report("kecil-3b", results)

    assert "kecil-3b" in report
    assert "1/2" in report  # overall
    assert "free-form: 1/1" in report and "hostile: 0/1" in report
    assert "model calls: 2" in report
    assert "FAIL" in report and "ada berapa api di Jakarta?" in report
    assert "ada berapa api di daerah Palangkaraya sekarang?" not in report  # a passing question is not repeated


def test_a_model_that_fails_is_counted_not_hidden(conn):
    from app.chat.model import ModelUnavailable

    model = FakeModel()
    model.will_say(ModelUnavailable("timeout"))

    results = run_cases(
        conn, model, [Case("free-form", "ada berapa api di daerah Palangkaraya sekarang?", kind="count")], NOW
    )
    report = format_report("kecil-3b", results)

    assert results[0].ok is False and results[0].simple_mode is True
    assert "simple mode: 1" in report


def test_the_default_questions_cover_every_kind_of_thing_the_ai_does():
    groups = {case.group for case in default_cases()}

    assert {"explanation", "synonym", "uncovered", "free-form", "follow-up", "greeting", "hostile"} <= groups
    assert len(default_cases()) >= 70
