"""Read queries shared by the map endpoints and the chat, so both always report the same numbers."""

from datetime import datetime, timedelta

import psycopg

# Ordered weakest to strongest; min_confidence keeps its own level and everything above it.
CONFIDENCE_LEVELS = ["low", "nominal", "high"]
# Hotspot data older than this is flagged so Responders do not mistake silence for safety.
STALE_AFTER = timedelta(hours=6)
TIME_WINDOWS = {"24h": timedelta(hours=24), "48h": timedelta(hours=48), "7d": timedelta(days=7)}


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
    params: list = [now - TIME_WINDOWS[window]]
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
