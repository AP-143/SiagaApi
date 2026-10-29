"""Build step of the Vercel deployment: put one flat copy of the embedding model in ./model.

fastembed's own download cache keeps every file twice (the file and a link to it), and the bundler follows
the links, which would double the size of the deployment. So the model is downloaded to a temporary cache
and only the real files are copied into the project. Keep the name in step with app/embeddings.py.
"""

import shutil
import tempfile
from pathlib import Path

from fastembed import TextEmbedding

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
TARGET = Path("model")

cache = tempfile.mkdtemp()
TextEmbedding(MODEL_NAME, cache_dir=cache)
snapshot = next(Path(cache).glob("models--*/snapshots/*"))
shutil.rmtree(TARGET, ignore_errors=True)
shutil.copytree(snapshot, TARGET, symlinks=False)
size = sum(p.stat().st_size for p in TARGET.rglob("*") if p.is_file())
print(f"embedding model copied to {TARGET}/ ({size / 1e6:.0f} MB)")
