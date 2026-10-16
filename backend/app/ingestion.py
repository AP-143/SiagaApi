import logging
import os
import time
import traceback
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone

import psycopg

from app.config import Settings
from app.firms import VIIRS_SOURCES, Detection, FirmsError, fetch_detections
from app.schema import ensure_schema

logger = logging.getLogger(__name__)

# FIRMS answers at most 5 days per request; 2 days overlaps generously between 30-minute runs.
LOOKBACK_DAYS = 2

# A Hotspot is kept only if its point lies inside a Province polygon (the Monitored Region).
# The Regency is optional: boundary gaps can leave a point inside a Province but in no Regency.
# It must belong to the Province chosen, so the two can never disagree where polygons overlap.
INSERT_HOTSPOT_SQL = """
INSERT INTO hotspots
    (satellite, latitude, longitude, acquired_at, confidence, province_code, regency_code,
     peat_hotspot, geom)
SELECT %(satellite)s, %(latitude)s, %(longitude)s, %(acquired_at)s, %(confidence)s,
       province.code,
       (SELECT r.code FROM regencies r
        WHERE r.province_code = province.code AND ST_Intersects(r.geom, point.geom)
        ORDER BY r.code LIMIT 1),
       EXISTS (SELECT 1 FROM peatlands pl WHERE ST_Intersects(pl.geom, point.geom)),
       point.geom
FROM (SELECT ST_SetSRID(ST_MakePoint(%(longitude)s, %(latitude)s), 4326) AS geom) point
JOIN LATERAL (
    SELECT p.code FROM provinces p WHERE ST_Intersects(p.geom, point.geom)
    ORDER BY p.code LIMIT 1
) province ON true
WHERE NOT EXISTS (
    SELECT 1 FROM hotspots h
    WHERE h.satellite = %(satellite)s AND h.latitude = %(latitude)s
      AND h.longitude = %(longitude)s AND h.acquired_at = %(acquired_at)s
)
ON CONFLICT (satellite, latitude, longitude, acquired_at) DO NOTHING
"""


@dataclass(frozen=True)
class IngestionResult:
    fetched: int
    stored: int


def run_ingestion(
    settings: Settings, clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc)
) -> IngestionResult:
    """Fetch recent VIIRS detections and store those inside the Monitored Region."""
    detections: list[Detection] = []
    for source in VIIRS_SOURCES:
        detections.extend(fetch_detections(settings, source, LOOKBACK_DAYS))

    stored = 0
    with psycopg.connect(settings.database_url) as conn:
        ensure_schema(conn)
        with conn.cursor() as cursor:
            for detection in detections:
                cursor.execute(
                    INSERT_HOTSPOT_SQL,
                    {
                        "satellite": detection.satellite,
                        "latitude": detection.latitude,
                        "longitude": detection.longitude,
                        "acquired_at": detection.acquired_at,
                        "confidence": detection.confidence,
                    },
                )
                stored += cursor.rowcount
        conn.execute(
            "INSERT INTO ingestion_runs (succeeded_at, fetched, stored) VALUES (%s, %s, %s)",
            (clock(), len(detections), stored),
        )
        conn.commit()
    return IngestionResult(fetched=len(detections), stored=stored)


def _where(error: BaseException) -> str:
    """The innermost file and line an error came from, without anything the error says."""
    frames = traceback.extract_tb(error.__traceback__)
    if not frames:
        return "unknown location"
    last = frames[-1]
    return f"{os.path.basename(last.filename)}:{last.lineno}"


def run_on_schedule(
    settings: Settings,
    interval_seconds: int = 30 * 60,
    sleep: Callable[[float], None] = time.sleep,
    max_runs: int | None = None,
) -> None:
    """Run ingestion forever (or max_runs times); a failed run is logged and the loop carries on."""
    runs = 0
    while max_runs is None or runs < max_runs:
        if runs:
            sleep(interval_seconds)
        runs += 1
        try:
            result = run_ingestion(settings)
            logger.info("ingestion fetched=%d stored=%d", result.fetched, result.stored)
        except FirmsError as error:
            logger.error("ingestion failed: %s", error)
        except Exception as error:
            # Never log the exception text or a traceback (which prints it): driver and HTTP errors
            # can echo connection strings and URLs, and a URL can carry the MAP_KEY. The kind of
            # error and where it was raised are enough to find it.
            logger.error("ingestion failed unexpectedly: %s at %s", type(error).__name__, _where(error))
