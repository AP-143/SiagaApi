# Go live: the two Vercel projects, the firewall rule and the secrets

Status: resolved
Blocked by: 04, 05, 06, 07

Spec: `../spec.md` (decisions 1, 3, 6, 7)

## What to do

The Vercel and Neon command lines are signed in on the owner's machine, so the agent can create the projects and set environment values from files without printing them. These steps stay with the owner, because they happen in a browser or need the owner's approval:

1. Request a new FIRMS `MAP_KEY` for the server.
2. Say yes before the agent does the first public deploy (it exposes the real database through a public address).
3. Create the one Vercel WAF rate-limit rule in the dashboard (Hobby allows one): per IP, for example 100 requests per 60 seconds, action 429. The agent gives the exact values.
4. Add the GitHub repository secrets `DATABASE_URL` (unpooled) and `FIRMS_MAP_KEY` (the agent can do it with the signed-in `gh`, or the owner pastes them in the settings page).

The agent does the rest: create the project `siagaapi-api` (root `backend/`, environment `DATABASE_URL` pooled, `KNOWLEDGE_EXCLUDE`, `KNOWLEDGE_RELOAD_ON_START=false`, `TRUST_FORWARDED_FOR=true`, `CORS_ALLOWED_ORIGINS`, `VERCEL_SUPPORT_LARGE_FUNCTIONS=1`), the project `siagaapi` (root `frontend/`, `VITE_API_BASE_URL`), the first production deploys, and the first ingest run.

## Acceptance criteria

- [x] Both projects are deployed and the API's `/health` answers ok on the public address.
- [ ] If anything asks for a card or a billing address, the work stops and the owner is told.
- [ ] No secret is printed in the terminal, committed, or visible in the built frontend.
- [x] The throwaway project `siagaapi-spike` and the Neon branch `spike` are deleted (ticket 10).

## Comments

2026-10-30, done: project `siagaapi-api` (https://siagaapi-api.vercel.app, environment set from files) and project `siagaapi` (https://siagaapi.vercel.app); the WAF rule "Rate limit per IP" (200 requests per 60 s per IP) is published and was checked live (230 quick requests: 200 allowed, 30 answered 429); the owner approved the first public deploy; the spike is deleted.

Still to do by the owner (the agent was not allowed to write to the secret store, and the FIRMS key can only be requested by the owner): request a new FIRMS MAP_KEY for the server, then add the repository secrets `DATABASE_URL` (the UNPOOLED Neon address) and `FIRMS_MAP_KEY` (Settings, Secrets and variables, Actions), then merge the pull request so the schedule starts.

2026-10-30, finished: the owner requested the FIRMS server key and set the secrets `DATABASE_URL` and `FIRMS_MAP_KEY`, and the pull requests 4 and 5 are merged. After a GitHub Login Connection, both Vercel projects were linked to this repository with `vercel git connect` (production branch `main`, root directories `backend` and `frontend`, preview deployments off); the merge of pull request 5 deployed both projects by itself and `/health`, `/`, `/peta` and a chat question answered after it.
