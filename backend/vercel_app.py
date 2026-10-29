"""Entrypoint of the Vercel deployment: Vercel looks for a top-level `app`.

Settings come from the project's environment variables (see .env.example). The model folder is made by
scripts/fetch_embedding_model.py during the build.
"""

import os
from pathlib import Path

os.environ.setdefault("EMBEDDING_MODEL_PATH", str(Path(__file__).resolve().parent / "model"))

from app.main import create_app  # noqa: E402

app = create_app()
