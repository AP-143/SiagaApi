# 02: Follow-up questions

**What to build:** A Responder can continue a conversation: after "Berapa titik api di Kalimantan Tengah hari ini?", asking "kalau yang di lahan gambut?" is answered as a peat question for the same place and window. The page sends the last few turns with each question and the server stays stateless. See `spec.md` and ADR 0003.

**Blocked by:** 01: Free-form questions understood by the model

**Status:** ready-for-agent

- [x] `POST /chat` accepts the last few turns (about 6 messages, each limited like a question) next to the new message; with no history it behaves as today; the server stores nothing
- [x] The model is called for a follow-up only when it needs the history; it rewrites the follow-up into a standalone question of at most 500 characters, which is then answered through the rules like any other question
- [x] The history is treated as untrusted input: a hostile history cannot change what the chat does, and an over-long or invalid rewrite becomes "not understood"
- [x] The count in a follow-up answer equals what `/hotspots/counts` reports for the rewritten question's filters
- [x] If the model is off or fails, a follow-up that needs history gets a plain "please ask the full question" reply in simple mode, not a wrong answer
- [x] The panel sends the last few turns with each question; a reload still starts fresh and nothing is stored
- [x] Seam 1 tests with the fake client cover: a follow-up on place, a follow-up on window and peat, a hostile history, an over-long rewrite, and the model being unavailable
- [x] Seam 2 tests cover the history sent with a question
