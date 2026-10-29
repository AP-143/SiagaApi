# The rate limiter sees the real client behind a proxy

Status: resolved
Blocked by: none

Spec: `../spec.md` (decision 2)

## What to build

Add a setting `TRUST_FORWARDED_FOR` (env var `TRUST_FORWARDED_FOR`, default false). When true, the rate limiter, for both the map allowance and the chat allowance, identifies a client by the right-most entry of the `X-Forwarded-For` header, falling back to the socket peer when the header is missing or empty. When false, nothing changes: the header is ignored, as the comment in `app/main.py` explains.

## Acceptance criteria

- [x] With the setting off, a forged `X-Forwarded-For` does not change which allowance a request uses (existing behaviour, now covered by a test).
- [x] With the setting on, two requests carrying different right-most entries use separate allowances, and a client that prepends fake entries on the left gains nothing.
- [x] With the setting on and no header, the socket peer is used.
- [x] Tests run in Docker against the real app like the others (`docker compose run --rm api python -m pytest`); `docker-compose.yml` and the README list the new setting.

## Comments

Done in `backend/app/config.py`, `backend/app/main.py`, `backend/tests/test_forwarded_for.py` (6 tests). `create_app(trust_forwarded_for=...)` overrides the setting for tests. `/health` stays exempt from the limiter. On Vercel the setting is `true`; the WAF rule is the real limit (ticket 08).
