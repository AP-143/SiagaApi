# 05: Global model call limits

**What to build:** A free quota is not used up by a few visitors. The whole application has a per-minute and a per-day limit on model calls; when either is spent, the chat answers from the rules and the panel says it is in simple mode until the limit resets. See `spec.md` and ADR 0003.

**Blocked by:** 01: Free-form questions understood by the model

**Status:** ready-for-agent

- [x] Global per-minute and per-day limits on model calls, both configurable in `.env` and documented in `.env.example`; they are separate from the existing per-client chat rate limit, whose `Retry-After` behavior is unchanged
- [x] When a limit is spent the chat gives the rule-based answer and the reply marks simple mode; no request fails because of it
- [x] The limits reset on their own windows, and a skipped call is not counted as spent
- [x] Logs say only that a call was skipped because of a limit, never the question
- [x] Seam 1 tests cover: the per-minute limit, the per-day limit, a limit resetting, a normal answer in simple mode when over budget, and the per-client limit still working beside them
- [x] Seam 2 tests cover the simple-mode notice appearing when the reply says so
