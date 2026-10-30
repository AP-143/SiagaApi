# The ingestor runs on a GitHub Actions schedule

Status: claimed
Blocked by: 05

Spec: `../spec.md` (decisions 6, 8); the secrets themselves are set in ticket 08.

## What to build

A workflow `.github/workflows/ingest.yml`: runs every 30 minutes and by hand (`workflow_dispatch`), sets up Python, installs the runtime packages (cached), and runs `python -m app.cli ingest` (the single-run form, not `--loop`) from `backend/` with `DATABASE_URL` and `FIRMS_MAP_KEY` from repository secrets. One run at a time (`concurrency`), a time limit, and a failed run is visible in the Actions tab. It must not print the secrets and must not run on pull requests from forks.

Use the unpooled URL for the secret. Note in the workflow comments that Actions schedules can be late and are switched off after 60 days without repository activity.

## Acceptance criteria

- [x] The workflow file passes a syntax check (`actionlint` or equivalent) and does only what is described above.
- [ ] Once the secrets are set, a manual run succeeds and the log shows the fetched and stored counts, not any secret.
- [x] A short section in `docs/hosting.md` explains how to see the last run, run it by hand, and turn it back on after the 60 day pause.

## Comments

Written (`.github/workflows/ingest.yml`) and linted clean with actionlint. Still to do after the merge to `main` and the secrets in ticket 08: one manual run, and the second run from the schedule.

2026-10-30: the first manual run was cancelled after 10 minutes (3,600 single-row inserts from a US runner to Singapore). Fixed in pull request 5 (one `INSERT ... FROM unnest(...)`); the manual run after the fix succeeded in 26 s ("Fetched 3633 detections, stored 0 new Hotspots"). Both secrets are set. Still open: GitHub had not started a scheduled run 1.5 hours after the merge (ticks at 23:00, 00:00 UTC missing; the workflow is active and the cron is on `main`), so the "two scheduled runs" check is not done yet.

2026-10-30: no scheduled run started in the first two hours after the merge (ticks at :00 and :30 all missing). The cron moved to minutes 7 and 37, away from the busy ticks.
