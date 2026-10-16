import json
from collections.abc import Callable
from typing import Literal
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from psycopg_pool import ConnectionPool

from pydantic import BaseModel, StringConstraints
from typing import Annotated

from app.chat.service import answer_question
from app.config import load_settings
from app.knowledge import load_knowledge
from app.queries import STALE_AFTER, hotspot_where, last_ingestion, regency_counts
from app.ratelimit import RateLimiter
from app.schema import ensure_schema

MAX_QUESTION_LENGTH = 500


class ChatRequest(BaseModel):
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_QUESTION_LENGTH)]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def create_app(
    clock: Callable[[], datetime] = utc_now,
    rate_limit_per_minute: int | None = None,
    chat_rate_limit_per_minute: int | None = None,
) -> FastAPI:
    settings = load_settings()
    limiter = RateLimiter(rate_limit_per_minute or settings.rate_limit_per_minute, clock)
    # A separate allowance, so asking a lot never uses up the map and the map never uses up the chat.
    chat_limiter = RateLimiter(
        chat_rate_limit_per_minute or settings.chat_rate_limit_per_minute, clock
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        pool = ConnectionPool(settings.database_url, open=True)
        try:
            with pool.connection() as conn:
                ensure_schema(conn)
                # A broken document stops the start-up on purpose: better a loud failure at
                # deploy time than a chat that quietly answers from a half-loaded knowledge base.
                load_knowledge(conn, settings.knowledge_dir)
        except BaseException:
            pool.close()
            raise
        app.state.pool = pool
        try:
            yield
        finally:
            pool.close()

    app = FastAPI(title="SiagaApi", lifespan=lifespan)
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    @app.middleware("http")
    async def rate_limit(request: Request, call_next):
        # Health checks come from the platform, not from the public. The client address is the
        # socket peer: X-Forwarded-For is client-controlled and would let anyone dodge the limit.
        if request.url.path != "/health":
            client = request.client.host if request.client else "unknown"
            is_chat = request.url.path == "/chat" and request.method == "POST"
            retry_after = (chat_limiter if is_chat else limiter).check(client)
            if retry_after is not None:
                return JSONResponse(
                    status_code=429,
                    content={"detail": f"Too many requests. Try again in {retry_after} seconds."},
                    headers={"Retry-After": str(retry_after)},
                )
        return await call_next(request)

    @app.get("/health")
    def health(request: Request, response: Response):
        try:
            with request.app.state.pool.connection() as conn:
                conn.execute("SELECT 1")
        except Exception:
            response.status_code = 503
            return {"status": "error", "database": "unreachable"}
        return {"status": "ok", "database": "ok"}

    def hotspot_filters(
        window: Literal["24h", "48h", "7d"] = "24h",
        province: str | None = None,
        regency: str | None = None,
        min_confidence: Literal["low", "nominal", "high"] = "nominal",
        peat_only: bool = False,
    ) -> tuple[str, list]:
        """The WHERE clause shared by the Hotspot list and the per-Regency counts."""
        return hotspot_where(clock(), window, province, regency, min_confidence, peat_only)

    @app.post("/chat")
    def chat(body: ChatRequest, request: Request):
        # POST only so the question travels in the body; it reads data and never changes any.
        with request.app.state.pool.connection() as conn:
            return answer_question(conn, body.message, clock())

    @app.get("/freshness")
    def freshness(request: Request):
        with request.app.state.pool.connection() as conn:
            last_updated = last_ingestion(conn)
        if last_updated is None:
            # Never ingested: there is nothing to trust, so say so.
            return {"last_updated": None, "stale": True}
        return {
            "last_updated": last_updated.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "stale": clock() - last_updated > STALE_AFTER,
        }

    @app.get("/hotspots/counts")
    def hotspot_counts(request: Request, filters: tuple[str, list] = Depends(hotspot_filters)):
        where, params = filters
        with request.app.state.pool.connection() as conn:
            rows = regency_counts(conn, where, params)
        return [
            {
                "regency": None if r_code is None else {"code": r_code, "name": r_name},
                "province": {"code": p_code, "name": p_name},
                "count": count,
            }
            for r_code, r_name, p_code, p_name, count in rows
        ]

    @app.get("/hotspots")
    def hotspots(request: Request, filters: tuple[str, list] = Depends(hotspot_filters)):
        where, params = filters
        with request.app.state.pool.connection() as conn:
            rows = conn.execute(
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
        features = []
        for (
            id_, lon, lat, acquired_at, satellite, confidence, p_code, p_name, r_code, r_name, peat
        ) in rows:
            features.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [lon, lat]},
                    "properties": {
                        "id": id_,
                        "acquired_at": acquired_at.astimezone(timezone.utc).strftime(
                            "%Y-%m-%dT%H:%M:%SZ"
                        ),
                        "satellite": satellite,
                        "confidence": confidence,
                        "province": {"code": p_code, "name": p_name},
                        "regency": None if r_code is None else {"code": r_code, "name": r_name},
                        "peat_hotspot": peat,
                    },
                }
            )
        return {"type": "FeatureCollection", "features": features}

    def feature_collection(rows) -> JSONResponse:
        # Boundaries and peat change only when a dataset is replaced, so browsers may keep them.
        return JSONResponse(
            {"type": "FeatureCollection", "features": rows},
            headers={"Cache-Control": "public, max-age=3600"},
        )

    @app.get("/layers/peatlands")
    def peatland_layer(request: Request):
        with request.app.state.pool.connection() as conn:
            rows = conn.execute(
                "SELECT ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom, 0.0003), 5) FROM peatlands"
                " ORDER BY id"
            ).fetchall()
        return feature_collection(
            [
                {"type": "Feature", "properties": {}, "geometry": json.loads(geometry)}
                for (geometry,) in rows
            ]
        )

    @app.get("/layers/provinces")
    def province_layer(request: Request):
        with request.app.state.pool.connection() as conn:
            rows = conn.execute(
                "SELECT code, name, ST_AsGeoJSON(geom_simple, 5) FROM provinces ORDER BY code"
            ).fetchall()
        return feature_collection(
            [
                {
                    "type": "Feature",
                    "properties": {"code": code, "name": name},
                    "geometry": json.loads(geometry),
                }
                for code, name, geometry in rows
            ]
        )

    @app.get("/layers/regencies")
    def regency_layer(request: Request):
        with request.app.state.pool.connection() as conn:
            rows = conn.execute(
                "SELECT code, name, province_code, ST_AsGeoJSON(geom_simple, 5)"
                " FROM regencies ORDER BY code"
            ).fetchall()
        return feature_collection(
            [
                {
                    "type": "Feature",
                    "properties": {"code": code, "name": name, "province_code": province_code},
                    "geometry": json.loads(geometry),
                }
                for code, name, province_code, geometry in rows
            ]
        )

    @app.get("/provinces")
    def provinces(request: Request):
        with request.app.state.pool.connection() as conn:
            rows = conn.execute("SELECT code, name FROM provinces ORDER BY name").fetchall()
        return [{"code": code, "name": name} for code, name in rows]

    @app.get("/provinces/{province_code}/regencies")
    def regencies(province_code: str, request: Request):
        with request.app.state.pool.connection() as conn:
            exists = conn.execute(
                "SELECT 1 FROM provinces WHERE code = %s", (province_code,)
            ).fetchone()
            if exists is None:
                raise HTTPException(status_code=404, detail="Province not found")
            rows = conn.execute(
                "SELECT code, name FROM regencies WHERE province_code = %s ORDER BY name",
                (province_code,),
            ).fetchall()
        return [{"code": code, "name": name} for code, name in rows]

    return app
