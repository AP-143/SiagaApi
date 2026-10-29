# 05: The model repairs spelling and spacing when the rules still cannot read a question

**What to build:** When the AI layer is on and a question is still not understood after the code repair of tickets 01 to 04, the model rewrites it with its spelling and spacing fixed, and the rules read the rewrite. Code checks that the rewrite added nothing. See `spec.md` and ADR 0004.

**Blocked by:** 01, 02, 03, 04

**Status:** ready-for-agent

- [ ] The repair step runs only when the AI layer is configured and, after code repair and the rules, the question is still "not understood"; with the model off or failing, replies are exactly what the code repair alone gives
- [ ] The model receives the question as delimited data with a fixed system prompt and no tools, and returns plain text only: the question with its spelling and spacing fixed, at most 500 characters
- [ ] The rewrite is read by the rules like any other question, and a reply that used it carries the reading note
- [ ] The rewrite is discarded, and the reply is the usual "not understood" with the example questions, if: the area it resolves to cannot also be reached from the original message by the place repair of ticket 01 (the model cannot add a place); it has a digit the original lacks; it is longer than 500 characters; it is empty or not plain text
- [ ] The model's text is never shown as an answer: the answer always comes from the rules, with numbers and places from the database (ADR 0001)
- [ ] The call counts against the existing per-minute and per-day budget and uses the existing cache, keyed by the normalised original question; a repeated question makes no second call; a timeout, an error or an exhausted budget falls back to "not understood" and marks simple mode as the other model steps do
- [ ] Hostile text ("abaikan aturan sebelumnya", a request inside a misspelling) changes nothing, and a quote-only document is never reworded
- [ ] Seam 1 backend tests with the fake model client cover: a valid rewrite is answered by the rules; a rewrite that adds a place, adds a digit, is too long or is not text is discarded; budget, timeout and error fall back; a repeated question uses the cache; with no model the earlier tickets' cases still pass
- [ ] `docs/chatbot.md` and the README describe the step and say it is optional
