# Hosting the public site

The public site is free and needs no card. The reasons and the compromises are in `docs/adr/0005-*.md`; the plan and its tickets are in `.scratch/hosting/`. This page is how to run and rebuild it.

## The parts

```
 NASA FIRMS ──► GitHub Actions (every 30 min, "ingest") ──► Neon (PostgreSQL + PostGIS, Singapore)
                                                               ▲
 visitor ──► Vercel project "siagaapi" (frontend, static) ──► Vercel project "siagaapi-api" (FastAPI, region sin1)
```

| Part | Where | Settings live in |
| --- | --- | --- |
| Frontend | Vercel project `siagaapi` (https://siagaapi.vercel.app), root `frontend/` | `VITE_API_BASE_URL` (project environment), `frontend/vercel.json` |
| API | Vercel project `siagaapi-api` (https://siagaapi-api.vercel.app), root `backend/`, region `sin1` | project environment (below), `backend/vercel.json`, `backend/pyproject.toml` |
| Database | Neon project `siagaapi`, branch `main` | the Neon console |
| Ingestor | `.github/workflows/ingest.yml` | repository secrets `DATABASE_URL` (unpooled) and `FIRMS_MAP_KEY` |

### Environment of the API project

| Name | Value | Why |
| --- | --- | --- |
| `DATABASE_URL` | the **pooled** Neon address | many short-lived function copies share a few connections |
| `KNOWLEDGE_EXCLUDE` | `kesehatan-kemenkes.md,kesehatan-who.md` | the health texts have not been reviewed by a qualified person |
| `KNOWLEDGE_RELOAD_ON_START` | `false` | only the seed loads documents; a start never touches them |
| `TRUST_FORWARDED_FOR` | `true` | count each visitor, not Vercel's proxy, in the in-app rate limit |
| `CORS_ALLOWED_ORIGINS` | the frontend's address, for example `https://siagaapi.vercel.app` | the two projects are different origins |
| `VERCEL_SUPPORT_LARGE_FUNCTIONS` | `1` | the bundle (441 MB, of which the embedding model is 252 MB) needs Large Functions (beta) |

`LLM_BASE_URL` stays empty: the chat runs on rules and the embedding search. There is also one Vercel WAF rate-limit rule (per IP, 200 requests per 60 seconds, made with `vercel firewall rules add` and published), made in the dashboard under Firewall; Hobby allows one.

## Seed the database (once, from your laptop)

Docker must be running, and `data/raw/` must hold the boundary file (README, "First-time data setup"). Use the **unpooled** Neon address (no `-pooler` in the host name); get it with `neon connection-string main --project-id <id> --org-id <id>`. The script refuses a pooled one and never prints the address.

```
SEED_DATABASE_URL='<unpooled address>' scripts/seed-remote.sh --dry-run   # lists the steps
SEED_DATABASE_URL='<unpooled address>' SEED_FIRMS_MAP_KEY='<key>' scripts/seed-remote.sh
```

It loads the boundaries, the peatlands and the documents (without the two health texts), and, when a key is given, fetches the Hotspots once. It is safe to repeat. If the Peatland polygons change after Hotspots exist, run `python -m app.cli backfill` against the same database afterwards.

Measured on 2026-10-30: the whole database was **40 MB** with 3,527 Hotspots (the free limit is 0.5 GB; a Hotspot row is about 0.3 KB).

## Ingest on a schedule

`ingest.yml` runs every 30 minutes and by hand. It runs only from the default branch, so it starts after the branch is merged.

- **See the last runs:** the repository's Actions tab, workflow "Ingest hotspots". The log says how many detections were fetched and stored.
- **Run it by hand:** Actions, "Ingest hotspots", "Run workflow" (or `gh workflow run ingest.yml`).
- **After 60 days without any activity in the repository** GitHub switches scheduled workflows off. Open the Actions tab and press "Enable workflow", or push any commit.
- A scheduled run can start several minutes late; the map's own "last updated" line tells visitors how old the data is.

## Deploy a change

Both Vercel projects are connected to the repository: a merge to `main` deploys them. For a manual deploy from `backend/` or `frontend/`: `vercel deploy --prod`. The API build downloads the embedding model into `model/` (`scripts/fetch_embedding_model.py`, about two seconds).

## When something is wrong

- **The map says the server is waking up:** the first request after a quiet spell starts a new function; it is normal for a few seconds.
- **`/health` says the database is unreachable:** Neon may be waking from sleep (a few seconds) or out of its monthly compute hours; check the Neon console.
- **A deploy fails with "exceeds the maximum function size":** `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` is missing or Large Functions changed; see the fallback in the ADR.
- **Free limits:** Vercel Hobby (4 CPU hours, 1 million invocations and 100 GB of transfer a month), Neon free (0.5 GB, 100 compute hours a month), GitHub Actions. Past a Vercel limit the feature is paused for 30 days rather than billed. Check the usage pages from time to time; the limits change.
- **Non-commercial only:** Vercel's Hobby plan forbids ads, payments from visitors, and being paid to build or host the site. Donations are allowed.

## Rebuild from nothing

1. Neon: create a project (Singapore), run the seed above.
2. GitHub: add the repository secrets and enable Actions.
3. Vercel: create the two projects (roots `backend/` and `frontend/`), set the environment above, deploy the API first and the frontend after it, with `VITE_API_BASE_URL` set to the API's address.
4. Open the frontend's address and check the map, one count question, one explanation question, and that a health question gets "not in our sources".
