import os
from datetime import datetime, timezone

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg import sql

ADMIN_DATABASE_URL = os.environ["DATABASE_URL"]
# The API's clock is frozen so time-window behavior is deterministic.
NOW = datetime(2026, 10, 16, 8, 0, tzinfo=timezone.utc)
TEST_DB_NAME = "siagaapi_test"


@pytest.fixture(autouse=True)
def _no_model_unless_a_test_asks(monkeypatch):
    """Tests never reach a real model, even when the developer's environment has one configured."""
    monkeypatch.delenv("LLM_BASE_URL", raising=False)


@pytest.fixture(scope="session")
def _test_database():
    """Create the throwaway PostGIS database once per session."""
    with psycopg.connect(ADMIN_DATABASE_URL, autocommit=True) as admin:
        admin.execute(
            sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(
                sql.Identifier(TEST_DB_NAME)
            )
        )
        admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(TEST_DB_NAME)))
    return psycopg.conninfo.make_conninfo(ADMIN_DATABASE_URL, dbname=TEST_DB_NAME)


@pytest.fixture
def database_url(_test_database):
    """The test database with an empty schema, fresh for every test."""
    with psycopg.connect(_test_database, autocommit=True) as conn:
        conn.execute("DROP SCHEMA public CASCADE")
        conn.execute("CREATE SCHEMA public")
        conn.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    return _test_database


@pytest.fixture
def fake_firms():
    from tests.fake_firms import FakeFirms

    server = FakeFirms()
    server.start()
    yield server
    server.stop()


@pytest.fixture
def client(database_url, monkeypatch, tmp_path):
    monkeypatch.setenv("DATABASE_URL", database_url)
    # An empty knowledge folder: tests of the map and of counting must not depend on the real
    # documents, which change as they are reviewed.
    empty_knowledge = tmp_path / "no-knowledge"
    empty_knowledge.mkdir()
    monkeypatch.setenv("KNOWLEDGE_DIR", str(empty_knowledge))
    from app.main import create_app

    with TestClient(create_app(clock=lambda: NOW)) as test_client:
        yield test_client


@pytest.fixture
def settings_for(fake_firms, database_url):
    """Settings that point ingestion at the fake FIRMS server and the test database."""
    from app.config import Settings
    from tests.helpers import SECRET_KEY

    return Settings(
        database_url=database_url,
        firms_map_key=SECRET_KEY,
        firms_base_url=fake_firms.url,
    )


@pytest.fixture
def api(client, database_url):
    """The API with the fixture Provinces and Regencies already loaded."""
    from app.boundaries import load_boundaries
    from tests import fixtures

    with psycopg.connect(database_url) as conn:
        load_boundaries(conn, fixtures.ALL_PROVINCES, fixtures.ALL_REGENCIES)
    return client
