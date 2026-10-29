"""A host that starts several copies of the API at once (a serverless one) runs ensure_schema in all of
them together; they must queue up, not deadlock."""

from concurrent.futures import ThreadPoolExecutor

import psycopg

from app.schema import ensure_schema

COPIES = 8


def start_one(url):
    with psycopg.connect(url) as conn:
        ensure_schema(conn)
        ensure_schema(conn)


def test_many_copies_making_the_schema_at_once_all_succeed(database_url):
    with ThreadPoolExecutor(max_workers=COPIES) as pool:
        futures = [pool.submit(start_one, database_url) for _ in range(COPIES)]
        errors = [future.exception() for future in futures]

    assert errors == [None] * COPIES


def test_many_copies_starting_over_an_existing_schema_all_succeed(database_url):
    with psycopg.connect(database_url) as conn:
        ensure_schema(conn)

    with ThreadPoolExecutor(max_workers=COPIES) as pool:
        futures = [pool.submit(start_one, database_url) for _ in range(COPIES)]
        errors = [future.exception() for future in futures]

    assert errors == [None] * COPIES
