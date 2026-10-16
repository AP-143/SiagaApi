# 10: Public API hardening

**What to build:** The public API is safe to expose without login: reads are rate limited, no write operation is reachable from outside, and the FIRMS `MAP_KEY` can never leak through it. See `spec.md`.

**Blocked by:** 03: Hotspot ingestion end-to-end

**Status:** ready-for-agent

- [x] Public endpoints enforce rate limiting, and exceeding the limit returns a clear error
- [x] No endpoint can create, change, or delete data; only the internal ingestion job writes
- [x] No response, error message, or log line exposes the `MAP_KEY`
- [x] Seam 1 tests cover the rate limit, the absence of write routes (write methods are rejected), and `MAP_KEY` never appearing in responses
