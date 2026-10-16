from dataclasses import dataclass

import psycopg

from app.schema import ensure_schema

# Recompute the derived tags from each Hotspot's stored coordinates against the datasets currently
# loaded. A Hotspot outside every Province is deliberately left alone (see run_backfill).
RECOMPUTE_SQL = """
WITH computed AS (
    SELECT h.id,
           province.code AS province_code,
           (SELECT r.code FROM regencies r WHERE ST_Intersects(r.geom, h.geom)
            ORDER BY r.code LIMIT 1) AS regency_code,
           EXISTS (SELECT 1 FROM peatlands pl WHERE ST_Intersects(pl.geom, h.geom)) AS peat_hotspot
    FROM hotspots h
    JOIN LATERAL (
        SELECT p.code FROM provinces p WHERE ST_Intersects(p.geom, h.geom)
        ORDER BY p.code LIMIT 1
    ) province ON true
)
UPDATE hotspots h
SET province_code = c.province_code,
    regency_code = c.regency_code,
    peat_hotspot = c.peat_hotspot
FROM computed c
WHERE c.id = h.id
  AND (h.province_code, h.regency_code, h.peat_hotspot)
      IS DISTINCT FROM (c.province_code, c.regency_code, c.peat_hotspot)
"""

OUTSIDE_REGION_SQL = """
SELECT count(*) FROM hotspots h
WHERE NOT EXISTS (SELECT 1 FROM provinces p WHERE ST_Intersects(p.geom, h.geom))
"""


@dataclass(frozen=True)
class BackfillResult:
    total: int
    changed: int
    outside_region: int


def run_backfill(conn: psycopg.Connection) -> BackfillResult:
    """Recompute Province, Regency, and Peat Hotspot for every stored Hotspot.

    Run this after replacing the boundary or Peatland dataset. It is safe to repeat.

    A Hotspot that no longer lies inside any Province is left exactly as it was and counted in
    `outside_region`: FIRMS only serves a few days back, so history cannot be re-fetched, and
    deleting it silently would be unrecoverable. The operator decides what to do with those.
    """
    ensure_schema(conn)
    changed = conn.execute(RECOMPUTE_SQL).rowcount
    (total,) = conn.execute("SELECT count(*) FROM hotspots").fetchone()
    (outside_region,) = conn.execute(OUTSIDE_REGION_SQL).fetchone()
    conn.commit()
    return BackfillResult(total=total, changed=changed, outside_region=outside_region)
