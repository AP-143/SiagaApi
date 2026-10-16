"""Read queries shared by the map endpoints and the chat, so both always report the same numbers."""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal

import psycopg

# Ordered weakest to strongest; min_confidence keeps its own level and everything above it.
CONFIDENCE_LEVELS = ["low", "nominal", "high"]
# Hotspot data older than this is flagged so Responders do not mistake silence for safety.
STALE_AFTER = timedelta(hours=6)


@dataclass(frozen=True)
class TimeWindow:
    delta: timedelta
    label: str  # how an answer says it in Indonesian


# The windows the map and the chat can show. Adding one is a line here and in the web app's list
# (frontend/src/filters.ts), which cannot read this table.
TIME_WINDOWS = {
    "24h": TimeWindow(timedelta(hours=24), "24 jam"),
    "48h": TimeWindow(timedelta(hours=48), "48 jam"),
    "7d": TimeWindow(timedelta(days=7), "7 hari"),
}
# The same keys as a type, for request validation: built from the table so there is no second list.
WindowKey = Literal[tuple(TIME_WINDOWS)]


@dataclass(frozen=True)
class Freshness:
    last_updated: datetime | None
    stale: bool


def hotspot_where(
    now: datetime,
    window: str = "24h",
    province: str | None = None,
    regency: str | None = None,
    min_confidence: str = "nominal",
    peat_only: bool = False,
) -> tuple[str, list]:
    """The WHERE clause shared by the Hotspot list, the per-Regency counts and the chat."""
    conditions = ["h.acquired_at >= %s"]
    params: list = [now - TIME_WINDOWS[window].delta]
    if province is not None:
        conditions.append("h.province_code = %s")
        params.append(province)
    conditions.append("h.confidence = ANY(%s)")
    params.append(CONFIDENCE_LEVELS[CONFIDENCE_LEVELS.index(min_confidence) :])
    if peat_only:
        conditions.append("h.peat_hotspot")
    if regency is not None:
        conditions.append("h.regency_code = %s")
        params.append(regency)
    return " AND ".join(conditions), params


def regency_counts(conn: psycopg.Connection, where: str, params: list) -> list[tuple]:
    """(regency_code, regency_name, province_code, province_name, count), busiest first."""
    return conn.execute(
        f"""
        SELECT h.regency_code, r.name, h.province_code, p.name, count(*)
        FROM hotspots h
        JOIN provinces p ON p.code = h.province_code
        LEFT JOIN regencies r ON r.code = h.regency_code
        WHERE {where}
        GROUP BY h.regency_code, r.name, h.province_code, p.name
        ORDER BY count(*) DESC, r.name NULLS LAST, p.name
        """,
        params,
    ).fetchall()


def count_hotspots(conn: psycopg.Connection, where: str, params: list) -> int:
    (count,) = conn.execute(f"SELECT count(*) FROM hotspots h WHERE {where}", params).fetchone()
    return count


def last_ingestion(conn: psycopg.Connection) -> datetime | None:
    (value,) = conn.execute("SELECT max(succeeded_at) FROM ingestion_runs").fetchone()
    return value


def freshness(conn: psycopg.Connection, now: datetime) -> Freshness:
    """When the data was last updated and whether that is too long ago. Never updated is stale."""
    last_updated = last_ingestion(conn)
    return Freshness(last_updated, last_updated is None or now - last_updated > STALE_AFTER)


def hotspot_rows(conn: psycopg.Connection, where: str, params: list) -> list[tuple]:
    """(id, lon, lat, acquired_at, satellite, confidence, province_code, province_name,
    regency_code, regency_name, peat_hotspot), newest first."""
    return conn.execute(
        f"""
        SELECT h.id, h.longitude, h.latitude, h.acquired_at, h.satellite, h.confidence,
               h.province_code, p.name, h.regency_code, r.name, h.peat_hotspot
        FROM hotspots h
        JOIN provinces p ON p.code = h.province_code
        LEFT JOIN regencies r ON r.code = h.regency_code
        WHERE {where}
        ORDER BY h.acquired_at DESC, h.id
        """,
        params,
    ).fetchall()


def peatland_geometries(conn: psycopg.Connection) -> list[tuple]:
    """One (geojson,) per peat polygon, simplified for drawing."""
    return conn.execute(
        "SELECT ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0003), 5) FROM peatlands"
        " ORDER BY id"
    ).fetchall()


def province_geometries(conn: psycopg.Connection) -> list[tuple]:
    """(code, name, geojson) for drawing; the display copy, not the one Hotspots are tagged with."""
    return conn.execute(
        "SELECT code, name, ST_AsGeoJSON(geom_simple, 5) FROM provinces ORDER BY code"
    ).fetchall()


def regency_geometries(conn: psycopg.Connection) -> list[tuple]:
    """(code, name, province_code, geojson) for drawing."""
    return conn.execute(
        "SELECT code, name, province_code, ST_AsGeoJSON(geom_simple, 5)"
        " FROM regencies ORDER BY code"
    ).fetchall()


def provinces(conn: psycopg.Connection) -> list[tuple]:
    return conn.execute("SELECT code, name FROM provinces ORDER BY name").fetchall()


def regencies_of(conn: psycopg.Connection, province_code: str) -> list[tuple] | None:
    """The Province's Regencies by name, or None if there is no such Province."""
    exists = conn.execute("SELECT 1 FROM provinces WHERE code = %s", (province_code,)).fetchone()
    if exists is None:
        return None
    return conn.execute(
        "SELECT code, name FROM regencies WHERE province_code = %s ORDER BY name",
        (province_code,),
    ).fetchall()
