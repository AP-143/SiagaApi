# SiagaApi

A public, near-real-time map of satellite-detected Hotspots across Indonesian Kalimantan, built for wildfire Responders. "Api" is Indonesian for fire; it is not an API. See `GLOSSARY.md` for the vocabulary and `.scratch/hotspot-map/spec.md` for the spec.

## Run locally

Requires Docker.

```
cp .env.example .env     # then put your FIRMS MAP_KEY in .env
docker compose up
```

- Landing: http://localhost:5173/ (a scrolling editorial page that explains what a Hotspot is; "Buka peta" leads on)
- Map: http://localhost:5173/peta (a link with filters, such as `/?province=ID62`, also opens the map)
- API: http://localhost:8000 (health check at `/health`)
- `ingestor` fetches Hotspots from NASA FIRMS every 30 minutes

### First-time data setup

The map needs the Province and Regency boundaries and the Peatland polygons before Hotspots are stored, because each Hotspot is tagged with them when it arrives. Load them once, then fetch Hotspots (see `docs/data-sources.md` for sources and licenses):

```
mkdir -p data/raw/hdx-cod-ab-idn data/raw/peat-kementan-kalimantan
docker compose run --rm api python scripts/fetch_hdx_boundaries.py /data/raw/hdx-cod-ab-idn/idn_admin1_2.geojson.zip
docker compose run --rm api python -m app.cli load-boundaries /data/raw/hdx-cod-ab-idn/idn_admin1_2.geojson.zip
docker compose run --rm api python -m app.cli fetch-peat /data/raw/peat-kementan-kalimantan/peat_kalimantan.geojson
docker compose run --rm api python -m app.cli load-peat /data/raw/peat-kementan-kalimantan/peat_kalimantan.geojson
docker compose run --rm ingestor python -m app.cli ingest      # fetch Hotspots now (only the ingestor holds the MAP_KEY)
```

If Hotspots were stored before a dataset was loaded or replaced, tag them again with `docker compose run --rm api python -m app.cli backfill`.

On Windows with Git Bash, prefix those commands with `MSYS_NO_PATHCONV=1`.

## Run the tests

Backend tests run in Docker against a real PostGIS database (Seam 1: ingestion and the read API, with a fake FIRMS server):

```
docker compose run --rm api pytest
```

Frontend tests run against a mocked API (Seam 2: user-visible UI behavior):

```
cd frontend && npm install && npm test
```

## Chat language model (optional)

The chat works on rules alone, and reads common typos, short forms and questions typed without spaces by code, with no model. A language model, when configured, helps it understand questions the rules cannot read, including badly misspelled ones (it only rewrites the spelling and spacing; the rules read the rewrite); numbers and places still come from the database (`docs/adr/0003-ai-layer-is-optional-grounded-and-swappable.md`). With no model, or when the model fails, the chat falls back to the rules and says it is in simple mode.

The API talks to any server that speaks the OpenAI chat format, chosen in `.env` (see `.env.example`): `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` and `LLM_TIMEOUT_SECONDS`. Leave `LLM_BASE_URL` empty to keep the model off.

**A local model** (free, nothing leaves your machine): start the optional Ollama service, pull a small model into it, then point the API at it.

```
docker compose --profile ai up -d ollama
docker compose exec ollama ollama pull <model>
```

The model measured best so far is `qwen2.5:3b` (see `docs/chatbot.md`): `ollama pull qwen2.5:3b`. Put `LLM_BASE_URL=http://ollama:11434/v1` and `LLM_MODEL=<model>` in `.env`, then restart the API (`docker compose up -d api`). A plain `docker compose up` never starts Ollama or downloads a model. A small model on a CPU can be slow, so raise `LLM_TIMEOUT_SECONDS` if answers fall back to simple mode.

**Choosing a model.** The automatic tests use a fake model and say nothing about how well a real one reads Indonesian. To measure that, run the evaluation (not part of CI) against the model you configured, or name another one with `--model`:

```
docker compose run --rm api python -m app.cli evaluate-model --model <model> [--verbose]
```

It asks about a hundred questions (explanations, synonyms, questions the documents do not cover, free-form counts, follow-ups, greetings and hostile ones) and prints how many the chat got right per group, how many calls failed, and how long it took. Results and the chosen default are in `docs/chatbot.md`. Add `--repair` to run only the misspelled and unspaced questions, each with and without the model.

**A hosted API**: set the same three variables to its address, model and key (for example Groq, OpenRouter or Cloudflare Workers AI). Free tiers have limits for the whole application, and some use prompts for training, so read the provider's terms first and never put a key in the repository.

## Chat knowledge

The chat explains terms (what a Hotspot is, why peat burns) by quoting the reviewed documents in `backend/knowledge/`. Check and reload them with `docker compose run --rm api python -m app.cli load-knowledge`; see `docs/chatbot.md` for how to add one.

## Data

Raw reference datasets are not committed. See `docs/data-sources.md` for what they are, where they come from, and their licenses.
