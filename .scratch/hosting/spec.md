# Put SiagaApi on the public internet for free, with no card and no billing address

Status: ready-for-agent

Design: `docs/adr/0005-free-card-free-hosting-on-vercel-neon-github-actions.md`

## Problem

SiagaApi runs only on the owner's laptop through Docker Compose. The owner wants it public and open to anyone, and wants to spend nothing at all. The first plan (one Oracle Cloud Always Free VM) was dropped because Oracle asks for a billing address. A second plan (GitHub Pages + Render) was replaced by this one after a spike showed Vercel runs the whole API for free, faster and with four times the memory.

## Target

A demo or portfolio level service, not an emergency service: it may be slow on the first visit after a quiet spell, and may be down now and then. The pages say it is unofficial. It stays **non-commercial** (a Vercel Hobby condition): no ads, no payments, nobody paid to build or host it. Donations are allowed.

## Solution

Four free parts, none of which needs a card (the owner confirmed Vercel asked for none):

| Part | Where | What it does |
| --- | --- | --- |
| Frontend | Vercel project 1, root `frontend/` (Vite, static) | The map and the Landing |
| API | Vercel project 2, root `backend/` (FastAPI, Python), function region `sin1` (Singapore) | Same code as local; bundle 441 MB, so it needs Large Functions (beta) |
| Database | Neon free project `siagaapi` (Singapore, PostGIS), already created | Hotspots, Provinces, Peatlands, knowledge passages; 0.5 GB |
| Ingestor | GitHub Actions scheduled workflow, every 30 minutes | Runs `python -m app.cli ingest` once against Neon |

The chat runs on rules plus the embedding search; there is no language model (`LLM_BASE_URL` empty). Vercel has no region in Indonesia; Singapore is the nearest, and the function and the database are both there.

## Decisions already made with the owner

1. **Two Vercel projects**, not Vercel Services (still beta). They are different origins, so the API allows the frontend's origin (`CORS_ALLOWED_ORIGINS`) and the frontend is built with `VITE_API_BASE_URL`. (Done: ticket 02.)
2. The first request after a quiet spell is slow, so the page says the server is waking up. No keep-alive pings.
3. **Rate limiting has two layers.** One Vercel WAF rule (Hobby allows one: per IP, for example 100 requests per 60 seconds) is the real limit. The limiter inside the API stays as a second layer (per instance, so best effort) and, with `TRUST_FORWARDED_FOR=true`, counts the right-most `X-Forwarded-For` entry. (Done: ticket 01.)
4. A notice on the Landing and in the map credits: unofficial project, NASA FIRMS as the source, data can be late, in an emergency contact BPBD or BNPB. (Done: ticket 03.)
5. **The health documents stay out** until a qualified person reviews them: `KNOWLEDGE_EXCLUDE` names them, and `KNOWLEDGE_RELOAD_ON_START=false` means a start never touches the documents; only the seed (`load-knowledge`) does. (Done: ticket 04.)
6. A new FIRMS `MAP_KEY` is requested for the server. It lives only in GitHub Secrets (the API does not need it). Nobody prints or commits `.env`.
7. The database is seeded once from the owner's laptop with the **unpooled** Neon URL; the API on Vercel uses the **pooled** URL (verified in the spike). No backup beyond that: if Neon is lost, the seed is repeated and only old Hotspot history is lost.
8. The ingestor stays on GitHub Actions (a Hobby cron on Vercel is limited and not needed).

## What the spike proved (2026-10-30, throwaway project and Neon branch `spike`)

- The unchanged FastAPI app runs on Vercel Python; `/health` reports the database ok through the pooled Neon URL.
- Count questions work; a health question is not answered; two paraphrases that only the embedding search can match were answered, so the model loads and runs in the function.
- Bundle: model 252 MB plus packages, 441 MB in all. Without `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` Vercel splits dependencies out and the 278 MB left (code + model) exceeds its 225 MB limit; with it the deploy passes.
- In Washington (the default region) a warm chat took about 2 s because every query crossed to Singapore; in `sin1` warm requests took 0.13 to 0.4 s and chat 0.1 to 1.5 s.
- Concurrent starts deadlocked in `ensure_schema`; fixed with an advisory lock and a test (`backend/tests/test_schema_concurrency.py`).
- Vercel reads packages from `pyproject.toml` and ignores `requirements.txt` when both exist; the embedding model has to be one flat copy, not fastembed's cache (which holds every file twice).

## Not in scope

- A language model (separate session once hosting is stable).
- A custom domain, uptime monitoring, backups outside Neon, CI/CD for the API (Vercel builds from the repository).
- Review of the health documents (a person qualified to review them has to do it; until then they stay excluded).
- Counters shared across API instances (best effort per instance, plus the WAF rule).

## Acceptance (end to end, on the public URL)

- The page opens over HTTPS, the map shows recent Hotspots, and the numbers match `GET /hotspots` on the API.
- A first request after a quiet spell works after the waking message, with no error shown.
- Chat answers a numbers question and an explanation question (including one only the embedding search can match), and a health question gets the "not in our sources" reply.
- Two different visitors do not share one rate-limit allowance (check the `X-Forwarded-For` handling and the WAF rule).
- The scheduled workflow has run at least twice and stored new Hotspots without a manual run.
- The notice is visible on both pages. Neither `.env` nor any key is in the repository, the logs, or the built frontend.

## Risks to check during the work

- **Large Functions is a beta.** If it is withdrawn or limited, the fallback is to download the model into `/tmp` on the first chat question of an instance (the download took about a second in the build) and to fall back to word search if that fails; or to go back to the Render plan, kept in git history of this spec.
- Cold start after a long idle was not measured in the spike; measure it in ticket 09.
- Neon free is 0.5 GB and 100 compute hours a month; check the database size after the seed and the compute hours after a week (the 30 minute ingest wakes the database each time).
- Scheduled workflows are switched off after 60 days without repository activity; the runbook says how to turn them back on.
- Vercel Hobby limits (4 CPU hours, 1 million invocations, 100 GB transfer a month): an overrun pauses the feature for 30 days rather than billing, as Vercel's documents describe; check the usage page after a week.
