# The frontend and the API can live on different origins

Status: resolved
Blocked by: none

Spec: `../spec.md` (decision 3)

## What to build

- The frontend reads a build-time `VITE_API_BASE_URL`. When it is empty the code keeps calling `/api/...` through the Vite dev proxy, exactly as today. When it is set, every request goes to that address instead.
- The Vite config reads a `base` (for example from `VITE_BASE_PATH`, default `/`) so a build can be served under `/SiagaApi/`; the router and any asset links must work under that subpath.
- The API reads `CORS_ALLOWED_ORIGINS` (comma-separated). Empty means no CORS headers, as today. When set, only those origins are allowed, only for the methods the app uses, and no credentials.

## Acceptance criteria

- [x] Frontend tests cover both modes of the base URL; a production build with the variable set contains no `/api/` call to its own origin.
- [x] A build with `VITE_BASE_PATH=/SiagaApi/` opens on a static file server under that subpath, including a reload on a non-root route (fall back to `index.html` or a hash-based route; pick whichever the existing router supports and say which).
- [x] An API test shows an allowed origin gets the CORS headers, and a different origin does not.
- [x] `.env.example`, `docker-compose.yml` and the README list the new settings.

## Comments

Done. API: `CORS_ALLOWED_ORIGINS` in `config.py`, `CORSMiddleware` added last so it is the outermost layer (a 429 carries the headers, and `Retry-After` is exposed); `backend/tests/test_cors.py` (6 tests). Frontend: `src/base.ts` (`apiUrl`, `withBase`, `pathInSite`) with `src/base.test.ts`; used by `api.ts`, the Landing pictures, the links to `/` and `/peta`, and `Root.tsx`; `vite.config.ts` reads `VITE_BASE_PATH`. With the two Vercel projects `VITE_BASE_PATH` stays `/` (it was written for GitHub Pages and is harmless). A build with an API address set calls that address (the `/api` text left in the bundle is the unreachable fallback inside `apiUrl`).
