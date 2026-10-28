# 01: Free-form questions understood by the model

**What to build:** A Responder types a question in their own words ("ada berapa api di daerah Palangkaraya sekarang?") into the "Tanya" panel and gets the same database-backed count answer as for a rule-friendly question. The rules still run first; only when they cannot read the question does a language model propose a structured intent, which code validates. Short greetings get a friendly reply. With no model configured, or when the model fails, the chat behaves exactly as it does today and the panel says it is in simple mode. See `spec.md` and ADR 0001, ADR 0003.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] Settings for the model base address, model name, key (never in logs or `repr`) and timeout; `.env.example` documents them with placeholders only; with no address the AI layer is off and every existing test passes unchanged
- [x] One OpenAI-compatible client returns text or a clear failure (timeout, HTTP error, malformed body) and never raises into a request
- [x] When the rules cannot understand a question, the model returns a structured intent that code validates against the known intents, places, windows and filters; an invalid or ambiguous result becomes "not understood" or a clarifying question, never a guess
- [x] Every count and place in a reply equals what `/hotspots/counts` reports for the same filters; no number or place name comes from model text
- [x] A short greeting or thanks gets a friendly reply with the example questions; topics outside the sources are turned away as today
- [x] User text is passed as delimited data under a fixed system prompt and the model has no tools; text like "abaikan semua aturan" changes nothing
- [x] The reply tells the panel whether the chat is in simple mode; a model failure gives the rule-based answer, not an error
- [x] The panel shows a typing indicator while an answer is pending, a short simple-mode notice (Indonesian), and a permanent note under the question box that questions are processed by an AI service and should hold no personal data, next to the existing "Hotspot is a satellite detection" note; the privacy note is shown only when the AI layer is on
- [x] `docker compose --profile ai up` starts an Ollama service; a plain `docker compose up` neither starts it nor downloads a model; the README explains both this and pointing the client at a hosted API instead
- [x] A fake model client with scripted replies is available to tests; no automatic test makes a network call to a model
- [x] Seam 1 tests with the fake client cover: off by default, free-form phrasing, an invalid intent, a hostile question, greetings, a timeout, an HTTP error, a malformed response, and the key never appearing in any response or log line
- [x] Seam 2 tests cover: the typing indicator, the simple-mode notice, and the privacy note shown and hidden
- [x] Layout is checked at 360x640, 390x760, 700x760 and 1100x600 as before
