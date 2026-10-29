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


# ---- The repair evaluation ----------------------------------------------------------------------------

from app.model_eval import REPAIR_GROUPS, format_repair_report, repair_cases, run_repair_cases  # noqa: E402


def test_the_repair_questions_cover_every_kind_of_slip_and_the_dangerous_cases():
    cases = repair_cases()

    assert {case.group for case in cases} == set(REPAIR_GROUPS)
    assert len(cases) >= 30


def test_a_repair_question_is_asked_with_code_alone_and_then_with_the_model(conn):
    model = FakeModel()
    model.will_say("berapa titik api di Sambas hari ini")  # the one question the code could not read
    cases = [
        Case("repair-short-form", "brp titik api di sambas", kind="count", area="Sambas"),
        Case("repair-letters", "brapa ttk apii di sambas hri ini", kind="count", area="Sambas"),
    ]

    results = run_repair_cases(conn, model, cases, NOW)

    assert [(r.code_ok, r.model_ok) for r in results] == [(True, True), (False, True)]
    assert [r.gained for r in results] == [False, True]
    assert [r.model_calls for r in results] == [0, 1]
    assert not any(r.wrong for r in results)


def test_a_model_that_turns_a_question_into_another_answer_is_reported_as_wrong(conn):
    model = FakeModel()
    model.will_say("berapa titik api di Sambas hari ini")  # the person wrote no place
    cases = [Case("repair-danger", "brapa ttk apii hri ini", kind="unsupported")]

    # The place check keeps this from reaching the person; the evaluation must still be able to see a wrong
    # reply if one ever did, so the judgement is tested on the result itself.
    results = run_repair_cases(conn, model, cases, NOW)

    assert results[0].model_ok is True and results[0].wrong is False

    from app.model_eval import RepairResult

    wrong = RepairResult(
        case=cases[0], code_ok=True, model_ok=False, code_kind="unsupported", model_kind="count",
        changed_by_model=True, model_calls=1, simple_mode=False, seconds=0.1, note="got count, wanted unsupported",
    )
    assert wrong.wrong is True and wrong.unused is False


def test_the_repair_report_counts_per_group_and_names_what_went_wrong(conn):
    model = FakeModel()
    model.will_say("", "berapa titik api di Sambas hari ini")
    cases = [
        Case("repair-letters", "brapa ttk apii di sambas hri ini", kind="count", area="Sambas"),
        Case("repair-letters", "brapa ttk apii di sambas hri", kind="count", area="Sambas"),
        Case("repair-no-spaces", "titikapidisambas", kind="count", area="Sambas"),
    ]

    report = format_repair_report("kecil-3b", run_repair_cases(conn, model, cases, NOW))

    assert "kecil-3b" in report
    assert "All: code alone 1/3 | with the model 2 | gained 1 | wrong 0 | asked but not used 1" in report
    assert "repair-letters: code alone 0/2 | with the model 1 | gained 1" in report
    assert "repair-no-spaces: code alone 1/1" in report
    assert "FAIL " in report and "brapa ttk apii di sambas hri ini ->" in report
    assert "titikapidisambas" not in report  # a question that was right is not repeated
