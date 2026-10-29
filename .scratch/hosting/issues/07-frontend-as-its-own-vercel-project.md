# The frontend is its own Vercel project

Status: resolved
Blocked by: 02, 03

Spec: `../spec.md` (decisions 1, 4)

## What was built

`frontend/vercel.json` rewrites `/peta` to `index.html`, because the router is the real path (a reload of `/peta` would otherwise be a 404). Vercel detects Vite, builds with `npm run build`, and serves `dist`. The project settings (ticket 08) are root directory `frontend`, and the environment variable `VITE_API_BASE_URL` set to the API project's address.

## Acceptance criteria

- [x] `vercel.json` has the one rewrite, and a production build with `VITE_API_BASE_URL` set calls that address (checked in ticket 02).
- [ ] On the public site `/` and `/peta` both open, also after a reload (ticket 09).

## Comments
