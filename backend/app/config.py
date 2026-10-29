import os
from dataclasses import dataclass, field
from pathlib import Path

# The reviewed documents the chat may quote live next to the code, in backend/knowledge.
DEFAULT_KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "knowledge"


@dataclass(frozen=True)
class Settings:
    database_url: str
    firms_map_key: str = field(repr=False)
    firms_base_url: str
    rate_limit_per_minute: int = 240
    # Asking costs more than reading the map (several queries per question, and a language model
    # if one is ever added), so a chat question is limited far more tightly.
    chat_rate_limit_per_minute: int = 20
    # Behind a trusted proxy (Render) the socket peer is always the proxy, so the client is read from
    # the right-most X-Forwarded-For entry, which the proxy adds. Off by default: a header a client
    # can set must never decide who it is.
    trust_forwarded_for: bool = False
    # Pages that may call the API from another origin; empty means no CORS headers at all.
    cors_allowed_origins: tuple[str, ...] = ()
    knowledge_dir: Path = DEFAULT_KNOWLEDGE_DIR
    # Documents (file names) a deployment keeps out, such as health texts nobody qualified has reviewed.
    knowledge_exclude: tuple[str, ...] = ()
    # Load the documents on every start (development). A serverless host starts often and several
    # copies at once, so there the documents are loaded only by the seed (`load-knowledge`).
    knowledge_reload_on_start: bool = True
    # The language model is optional: with no address the chat works on rules alone (ADR 0003).
    llm_base_url: str = ""
    llm_model: str = ""
    llm_api_key: str = field(default="", repr=False)
    llm_timeout_seconds: float = 20.0
    # Whole-application limits on model calls, kept below a typical free tier.
    llm_calls_per_minute: int = 20
    llm_calls_per_day: int = 500


def _flag(name: str, default: bool = False) -> bool:
    text = os.environ.get(name, "").strip().lower()
    return default if not text else text in ("1", "true", "yes", "on")


def _names(text: str) -> tuple[str, ...]:
    """A comma-separated list of names, spaces around them ignored."""
    return tuple(part.strip() for part in text.split(",") if part.strip())


def _origins(text: str) -> tuple[str, ...]:
    """A comma-separated list of origins; a trailing slash is dropped because browsers never send one."""
    return tuple(part.strip().rstrip("/") for part in text.split(",") if part.strip())


def load_settings() -> Settings:
    return Settings(
        database_url=os.environ["DATABASE_URL"],
        firms_map_key=os.environ.get("FIRMS_MAP_KEY", ""),
        firms_base_url=os.environ.get("FIRMS_BASE_URL", "https://firms.modaps.eosdis.nasa.gov"),
        rate_limit_per_minute=int(os.environ.get("RATE_LIMIT_PER_MINUTE", "240")),
        chat_rate_limit_per_minute=int(os.environ.get("CHAT_RATE_LIMIT_PER_MINUTE", "20")),
        trust_forwarded_for=_flag("TRUST_FORWARDED_FOR"),
        cors_allowed_origins=_origins(os.environ.get("CORS_ALLOWED_ORIGINS", "")),
        knowledge_dir=Path(os.environ.get("KNOWLEDGE_DIR", str(DEFAULT_KNOWLEDGE_DIR))),
        knowledge_exclude=_names(os.environ.get("KNOWLEDGE_EXCLUDE", "")),
        knowledge_reload_on_start=_flag("KNOWLEDGE_RELOAD_ON_START", default=True),
        llm_base_url=os.environ.get("LLM_BASE_URL", ""),
        llm_model=os.environ.get("LLM_MODEL", ""),
        llm_api_key=os.environ.get("LLM_API_KEY", ""),
        llm_timeout_seconds=float(os.environ.get("LLM_TIMEOUT_SECONDS", "20")),
        llm_calls_per_minute=int(os.environ.get("LLM_CALLS_PER_MINUTE", "20")),
        llm_calls_per_day=int(os.environ.get("LLM_CALLS_PER_DAY", "500")),
    )
