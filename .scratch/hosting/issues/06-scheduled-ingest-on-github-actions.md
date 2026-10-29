# The ingestor runs on a GitHub Actions schedule

Status: ready-for-agent
Blocked by: 05

Spec: `../spec.md` (decisions 6, 8); the secrets themselves are set in ticket 08.

## What to build

A workflow `.github/workflows/ingest.yml`: runs every 30 minutes and by hand (`workflow_dispatch`), sets up Python, installs the runtime packages (cached), and runs `python -m app.cli ingest` (the single-run form, not `--loop`) from `backend/` with `DATABASE_URL` and `FIRMS_MAP_KEY` from repository secrets. One run at a time (`concurrency`), a time limit, and a failed run is visible in the Actions tab. It must not print the secrets and must not run on pull requests from forks.

Use the unpooled URL for the secret. Note in the workflow comments that Actions schedules can be late and are switched off after 60 days without repository activity.

## Acceptance criteria

- [ ] The workflow file passes a syntax check (`actionlint` or equivalent) and does only what is described above.
- [ ] Once the secrets are set, a manual run succeeds and the log shows the fetched and stored counts, not any secret.
- [ ] A short section in `docs/hosting.md` explains how to see the last run, run it by hand, and turn it back on after the 60 day pause.

## Comments
