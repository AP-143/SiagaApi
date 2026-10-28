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
    knowledge_dir: Path = DEFAULT_KNOWLEDGE_DIR
    # The language model is optional: with no address the chat works on rules alone (ADR 0003).
    llm_base_url: str = ""
    llm_model: str = ""
    llm_api_key: str = field(default="", repr=False)
    llm_timeout_seconds: float = 20.0
    # Whole-application limits on model calls, kept below a typical free tier.
    llm_calls_per_minute: int = 20
    llm_calls_per_day: int = 500


def load_settings() -> Settings:
    return Settings(
        database_url=os.environ["DATABASE_URL"],
        firms_map_key=os.environ.get("FIRMS_MAP_KEY", ""),
        firms_base_url=os.environ.get("FIRMS_BASE_URL", "https://firms.modaps.eosdis.nasa.gov"),
        rate_limit_per_minute=int(os.environ.get("RATE_LIMIT_PER_MINUTE", "240")),
        chat_rate_limit_per_minute=int(os.environ.get("CHAT_RATE_LIMIT_PER_MINUTE", "20")),
        knowledge_dir=Path(os.environ.get("KNOWLEDGE_DIR", str(DEFAULT_KNOWLEDGE_DIR))),
        llm_base_url=os.environ.get("LLM_BASE_URL", ""),
        llm_model=os.environ.get("LLM_MODEL", ""),
        llm_api_key=os.environ.get("LLM_API_KEY", ""),
        llm_timeout_seconds=float(os.environ.get("LLM_TIMEOUT_SECONDS", "20")),
        llm_calls_per_minute=int(os.environ.get("LLM_CALLS_PER_MINUTE", "20")),
        llm_calls_per_day=int(os.environ.get("LLM_CALLS_PER_DAY", "500")),
    )
