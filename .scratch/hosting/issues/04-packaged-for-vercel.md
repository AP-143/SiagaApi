# The API is packaged for Vercel

Status: resolved
Blocked by: 01, 02

Spec: `../spec.md` (decisions 3, 5; "What the spike proved")

## What was built

- `backend/vercel_app.py` (the entrypoint with a top-level `app`), `backend/pyproject.toml` (`[project]` with the runtime packages, `[tool.vercel]` entrypoint and build script), `backend/scripts/fetch_embedding_model.py` (copies one flat copy of the embedding model into `model/`), `backend/vercel.json` (region `sin1`, files kept out of the bundle). `app/embeddings.py` reads `EMBEDDING_MODEL_PATH`.
- `KNOWLEDGE_EXCLUDE` and `KNOWLEDGE_RELOAD_ON_START` (config, loader, CLI, start-up) and an advisory lock in `ensure_schema`.
- Tests: `test_knowledge_deployment.py` (7), `test_schema_concurrency.py` (2, a deadlock reproduced before the fix), `test_embeddings_path.py` (2), `test_deployment_files.py` (2: pyproject packages are all in requirements.txt, no pytest or uvicorn). The whole backend suite passes.

## Acceptance criteria

- [x] A test shows a document named in `KNOWLEDGE_EXCLUDE` produces no passages, and a question about its topic gets the "not in our sources" reply.
- [x] Measured on a throwaway Vercel project: bundle 441 MB (needs `VERCEL_SUPPORT_LARGE_FUNCTIONS=1`), warm requests 0.13 to 0.4 s in `sin1`, the first chat question that needs the model on a fresh instance several seconds.
- [x] Concurrent starts no longer deadlock.
- [x] Repeat the deploy from the real `backend/` folder (ticket 08) and note the bundle size and the cold start after a long idle in the comments.

## Comments

Real deploy of `backend/` (project `siagaapi-api`, 2026-10-30): the build took 15 s (model copy 252 MB), Vercel reported "exceeds the standard size limit; enabling large functions (beta)" and went ahead. Warm requests 0.14 to 1.1 s from this machine in Indonesia; the first chat question needing the embedding model about 1 s. The cold start after a long idle is not measured yet (ticket 09).

Cold start after 20 minutes idle, measured 2026-10-30: first `/health` 2.4 s, the next ones 0.1 s (the first request of an earlier, shorter pause: 2.5 s). Well under the 8 s waking message.
