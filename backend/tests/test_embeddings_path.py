"""On a serverless host the embedding model ships inside the deployment, in one flat folder, instead of in
the image's download cache; EMBEDDING_MODEL_PATH says where."""

import sys
import types

import pytest

from app import embeddings


class FakeTextEmbedding:
    calls = []

    def __init__(self, *args, **kwargs):
        FakeTextEmbedding.calls.append((args, kwargs))


@pytest.fixture
def fake_fastembed(monkeypatch):
    FakeTextEmbedding.calls = []
    module = types.ModuleType("fastembed")
    module.TextEmbedding = FakeTextEmbedding
    monkeypatch.setitem(sys.modules, "fastembed", module)
    embeddings._model.cache_clear()
    yield FakeTextEmbedding
    embeddings._model.cache_clear()


def test_by_default_the_model_is_found_by_name_in_the_download_cache(fake_fastembed, monkeypatch):
    monkeypatch.delenv("EMBEDDING_MODEL_PATH", raising=False)

    embeddings._model()

    assert fake_fastembed.calls == [((embeddings.MODEL_NAME,), {})]


def test_with_a_model_path_the_files_are_read_from_that_folder(fake_fastembed, monkeypatch):
    monkeypatch.setenv("EMBEDDING_MODEL_PATH", "/var/task/model")

    embeddings._model()

    assert fake_fastembed.calls == [((embeddings.MODEL_NAME,), {"specific_model_path": "/var/task/model"})]
