# The public site runs on Vercel, Neon and GitHub Actions, all free and with no card

Status: accepted

SiagaApi has to be public, cost nothing, and be reachable without giving any payment method or billing address. The first plan, one Oracle Cloud Always Free VM running everything, was dropped because Oracle asks for a billing address at sign-up. A second plan, GitHub Pages plus a Render free service, was replaced after a spike showed that the whole API runs on Vercel's free plan. This ADR records the plan and its compromises. The work is in `.scratch/hosting/`.

## Decisions

1. **Four free parts.** The frontend and the API are two Vercel projects on the Hobby plan (the frontend static, the API a FastAPI function in the Singapore region). The database is a Neon free project with PostGIS, also in Singapore. The ingestor is a GitHub Actions workflow on a 30 minute schedule that runs the existing single-run `ingest` command against Neon, so no always-on process is needed.
2. **The target is a demo, and it stays non-commercial.** Vercel's Hobby plan is for personal, non-commercial use: no ads, no payments from visitors, nobody paid to build or host the site (donations are allowed). If that ever changes, the site moves to a paid plan or another host. The site may be slow on the first visit after a quiet spell, or down for a while, and its pages say it is unofficial and send people to BPBD or BNPB in an emergency.
3. **No keep-alive pings.** The frontend shows a friendly waking message when the first request is slow.
4. **The chat keeps its embedding search and has no language model.** The embedding model ships inside the function (see consequences); `LLM_BASE_URL` stays empty, which is ADR 0003's "AI layer off" mode.
5. **The health documents are excluded, by setting, and documents load only by the seed.** They have not been reviewed by someone qualified. `KNOWLEDGE_EXCLUDE` makes the loader skip named files. `KNOWLEDGE_RELOAD_ON_START=false` stops the API from deleting and reloading all documents at every start, which on a serverless host would happen at every cold start, in several copies at once.
6. **Schema creation is serialised.** Several copies of the API start at once on Vercel; their `CREATE` and `ALTER` statements deadlocked in the spike. `ensure_schema` now takes a PostgreSQL advisory lock first, so copies queue.
7. **Cross-origin by configuration.** The two projects are different origins, so the frontend takes its API address at build time (`VITE_API_BASE_URL`) and the API allows only the frontend's origin (`CORS_ALLOWED_ORIGINS`). Development keeps the Vite proxy.
8. **Rate limiting in two layers.** One Vercel WAF rate-limit rule (Hobby allows one, keyed by IP) is the real limit. The limiter inside the API stays as a second layer: per instance, so best effort, and with `TRUST_FORWARDED_FOR=true` it counts the right-most `X-Forwarded-For` entry instead of the proxy's address. The default keeps the old rule that a client-supplied header is never trusted.
9. **Secrets live only in GitHub Secrets and Vercel's environment.** A new FIRMS key is requested for the server and is needed only by the workflow; the API needs the pooled database address. The unpooled address is used for the seed and the ingest. Nothing is printed, committed, or put in the built frontend.
10. **No backups beyond Neon itself.** The static data is rebuilt by repeating the seed; only old Hotspot history is lost, and FIRMS serves just a few days back.

## Considered options

- **Oracle Cloud Always Free, one VM for everything.** Rejected: asks for a billing address. It would have been the simplest design (Compose plus a reverse proxy, a local model possible).
- **GitHub Pages for the frontend and Render free for the API.** Replaced, and kept as the fallback. Render sleeps after 15 minutes and takes about a minute to wake, has 512 MB of memory (the embedding model and its runtime would not clearly fit), and its documents do not say whether sign-up needs a card. Vercel's function has 2 GB, wakes in seconds, and one provider serves both parts.
- **Koyeb, Fly.io, Railway, Hugging Face Docker Spaces.** Rejected: they ask for a card, give only a short trial, or reports disagree on whether they stayed free (as far as free tiers could be checked in October 2026).
- **Vercel Services (frontend and API in one project).** Deferred: still beta, and it needs routing that was not tried here. Two projects reuse the cross-origin work already done.
- **A static snapshot site with no API.** Rejected: the chat, the place filters and the spatial queries are the product, and they run against PostGIS.
- **A keep-alive ping from Actions.** Rejected for now: a waking message is enough for a demo.

## Consequences

- **The API bundle is 441 MB and needs Large Functions (beta).** Of that, 252 MB is the embedding model. Vercel splits dependencies from the application when a bundle is large and then limits the application part to 225 MB, which the model alone exceeds; setting `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` lets the deploy through. A beta can change. The fallback is to download the model into `/tmp` on the first chat question of an instance (about a second at build time, with word search as the answer if it fails), or to go back to Render.
- **The model ships as one flat folder.** fastembed's cache holds every file twice and the bundler follows the links, so `scripts/fetch_embedding_model.py` (the Vercel build step) copies the real files once, and `EMBEDDING_MODEL_PATH` points the code at them. Vercel reads packages from `pyproject.toml` and ignores `requirements.txt` when both exist, so `pyproject.toml` lists the runtime packages and a test checks that they are all in `requirements.txt`.
- **The function runs in Singapore, next to the database.** In Washington, the default, a warm chat took about 2 s because each query crossed the world; in Singapore warm requests took 0.13 to 0.4 s. There is no Indonesian region at Vercel or Neon.
- **Free limits are the limits.** Vercel Hobby: 4 CPU hours, 1 million invocations and 100 GB of transfer a month; an overrun pauses the feature for 30 days rather than billing. Neon: 0.5 GB and 100 compute hours a month, asleep when idle (the 30 minute ingest wakes it each time). Actions: scheduled runs can be late and are paused after 60 days with no repository activity. All of these change; re-check them in each console.
- **Counters stay per instance.** The model budget, the explanation cache and the in-app limiter are per instance on a serverless host, so the limiter is best effort and the WAF rule is the real limit. A language model on this hosting would need its call limit moved out of process first.
- **Review of the health documents stays open.** Turning them on is a one-line change (empty `KNOWLEDGE_EXCLUDE`, then the seed) once a qualified person has reviewed them.
- **ADR 0003's note that the only free host able to run a model is an Oracle ARM VM no longer helps.** A language model on this hosting needs a separate decision (a hosted free API, with its data terms checked).
