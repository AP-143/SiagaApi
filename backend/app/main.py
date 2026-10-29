import json
from collections.abc import Callable
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from psycopg_pool import ConnectionPool
from pydantic import BaseModel, Field, StringConstraints

from app import queries
from app.chat.budget import BudgetedModel
from app.chat.explain import ExplanationCache
from app.chat.model import ModelClient
from app.chat.model_http import OpenAICompatibleClient
from app.chat.service import answer_question
from app.config import load_settings
from app.knowledge import load_knowledge
from app.queries import WindowKey, hotspot_where
from app.ratelimit import RateLimiter
from app.schema import ensure_schema
from app.timefmt import iso_utc

MAX_QUESTION_LENGTH = 500


MAX_HISTORY_TURNS = 6


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_QUESTION_LENGTH)]


class ChatRequest(BaseModel):
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_QUESTION_LENGTH)]
    # The browser's last few turns, so a follow-up can be understood. The server keeps nothing.
    history: Annotated[list[Turn], Field(max_length=MAX_HISTORY_TURNS)] = []


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def create_app(
    clock: Callable[[], datetime] = utc_now,
    rate_limit_per_minute: int | None = None,
    chat_rate_limit_per_minute: int | None = None,
    model: ModelClient | None = None,
    model_calls_per_minute: int | None = None,
    model_calls_per_day: int | None = None,
    trust_forwarded_for: bool | None = None,
) -> FastAPI:
    settings = load_settings()
    if trust_forwarded_for is None:
        trust_forwarded_for = settings.trust_forwarded_for
    if model is None and settings.llm_base_url:
        model = OpenAICompatibleClient(
            settings.llm_base_url,
            settings.llm_model,
            settings.llm_api_key,
            settings.llm_timeout_seconds,
        )
    if model is not None:
        # A free quota belongs to the whole application, so it is spent here, once, for every client.
        model = BudgetedModel(
            model,
            model_calls_per_minute or settings.llm_calls_per_minute,
            model_calls_per_day or settings.llm_calls_per_day,
            clock,
        )
    explanations = ExplanationCache()  # model-written explanations already given, kept for this process
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
                if settings.knowledge_reload_on_start:
                    load_knowledge(conn, settings.knowledge_dir, settings.knowledge_exclude)
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
        # socket peer: X-Forwarded-For is client-controlled and would let anyone dodge the limit,
        # unless the API is told it sits behind a proxy that adds the real address on the right.
        if request.url.path != "/health":
            client = request.client.host if request.client else "unknown"
            if trust_forwarded_for:
                client = request.headers.get("x-forwarded-for", "").split(",")[-1].strip() or client
            is_chat = request.url.path == "/chat" and request.method == "POST"
            retry_after = (chat_limiter if is_chat else limiter).check(client)
            if retry_after is not None:
                return JSONResponse(
                    status_code=429,
                    content={"detail": f"Too many requests. Try again in {retry_after} seconds."},
                    headers={"Retry-After": str(retry_after)},
                )
        return await call_next(request)

    if settings.cors_allowed_origins:
        # Added last so it is the outermost layer: a 429 must carry the headers too, or the page
        # could not read it. Read-only API, so GET plus the chat's POST, and never credentials.
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(settings.cors_allowed_origins),
            allow_methods=["GET", "POST"],
            allow_headers=["Content-Type"],
            expose_headers=["Retry-After"],
        )

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
        window: WindowKey = "24h",
        province: str | None = None,
        regency: str | None = None,
        min_confidence: Literal["low", "nominal", "high"] = "nominal",
        peat_only: bool = False,
    ) -> tuple[str, list]:
        """The WHERE clause shared by the Hotspot list and the per-Regency counts."""
        return hotspot_where(clock(), window, province, regency, min_confidence, peat_only)

    @app.get("/chat/status")
    def chat_status():
        # Only configuration: the panel needs to know before the first question whether to warn
        # that questions go to an AI service.
        return {"ai": model is not None}

    @app.post("/chat")
    def chat(body: ChatRequest, request: Request):
        # POST only so the question travels in the body; it reads data and never changes any.
        with request.app.state.pool.connection() as conn:
            history = [(turn.role, turn.text) for turn in body.history]
            return answer_question(conn, body.message, clock(), model, history, explanations)

    @app.get("/freshness")
    def freshness(request: Request):
        with request.app.state.pool.connection() as conn:
            current = queries.freshness(conn, clock())
        return {"last_updated": iso_utc(current.last_updated), "stale": current.stale}

    @app.get("/hotspots/counts")
    def hotspot_counts(request: Request, filters: tuple[str, list] = Depends(hotspot_filters)):
        where, params = filters
        with request.app.state.pool.connection() as conn:
            rows = queries.regency_counts(conn, where, params)
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
            rows = queries.hotspot_rows(conn, where, params)
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
                        "acquired_at": iso_utc(acquired_at),
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
            rows = queries.peatland_geometries(conn)
        return feature_collection(
            [
                {"type": "Feature", "properties": {}, "geometry": json.loads(geometry)}
                for (geometry,) in rows
            ]
        )

    @app.get("/layers/provinces")
    def province_layer(request: Request):
        with request.app.state.pool.connection() as conn:
            rows = queries.province_geometries(conn)
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
            rows = queries.regency_geometries(conn)
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
            rows = queries.provinces(conn)
        return [{"code": code, "name": name} for code, name in rows]

    @app.get("/provinces/{province_code}/regencies")
    def regencies(province_code: str, request: Request):
        with request.app.state.pool.connection() as conn:
            rows = queries.regencies_of(conn, province_code)
        if rows is None:
            raise HTTPException(status_code=404, detail="Province not found")
        return [{"code": code, "name": name} for code, name in rows]

    return app
