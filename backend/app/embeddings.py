"""Turning short texts into vectors, so a question can be matched to a passage by meaning.

The model runs inside this process (ONNX through fastembed) and ships in the image, so it costs
nothing, sends no text anywhere, and works with no network. It is multilingual, which is what
Indonesian needs. Keep the name in step with the Dockerfile, which downloads it at build time.
"""

from functools import lru_cache

import numpy as np

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


@lru_cache(maxsize=1)
def _model():
    from fastembed import TextEmbedding

    return TextEmbedding(MODEL_NAME)


def embed(texts: list[str]) -> list[list[float]]:
    """One unit-length vector per text, so the dot product of two of them is their cosine similarity."""
    vectors = np.array(list(_model().embed(texts)), dtype=np.float32)
    vectors /= np.linalg.norm(vectors, axis=1, keepdims=True)
    return vectors.tolist()
