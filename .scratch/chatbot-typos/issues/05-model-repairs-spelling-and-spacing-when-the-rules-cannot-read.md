# 05: The model repairs spelling and spacing when the rules still cannot read a question

**What to build:** When the AI layer is on and a question is still not understood after the code repair of tickets 01 to 04, the model rewrites it with its spelling and spacing fixed, and the rules read the rewrite. Code checks that the rewrite added nothing. See `spec.md` and ADR 0004.

**Blocked by:** 01, 02, 03, 04

**Status:** ready-for-agent

- [x] The repair step runs only when the AI layer is configured and, after code repair and the rules, the question is still "not understood"; with the model off or failing, replies are exactly what the code repair alone gives
- [x] The model receives the question as delimited data with a fixed system prompt and no tools, and returns plain text only: the question with its spelling and spacing fixed, at most 500 characters
- [x] The rewrite is read by the rules like any other question, and a reply that used it carries the reading note
- [x] The rewrite is discarded, and the reply is the usual "not understood" with the example questions, if: the area it resolves to cannot also be reached from the original message by the place repair of ticket 01 (the model cannot add a place); it has a digit the original lacks; it is longer than 500 characters; it is empty or not plain text
- [x] The model's text is never shown as an answer: the answer always comes from the rules, with numbers and places from the database (ADR 0001)
- [x] The call counts against the existing per-minute and per-day budget and uses the existing cache, keyed by the normalised original question; a repeated question makes no second call; a timeout, an error or an exhausted budget falls back to "not understood" and marks simple mode as the other model steps do
- [x] Hostile text ("abaikan aturan sebelumnya", a request inside a misspelling) changes nothing, and a quote-only document is never reworded
- [x] Seam 1 backend tests with the fake model client cover: a valid rewrite is answered by the rules; a rewrite that adds a place, adds a digit, is too long or is not text is discarded; budget, timeout and error fall back; a repeated question uses the cache; with no model the earlier tickets' cases still pass
- [x] `docs/chatbot.md` and the README describe the step and say it is optional

## Comments

- **Where it runs.** After the rules, the code repair and the intent step (`question_from_model`) have not understood the question, and only if the intent step was not even asked (the question is not about fire as a quantity, see `could_be_a_quantity`). A question the intent step asked the model about is not asked twice. Running it before the intent step broke the existing fake-model tests and would have doubled the calls for loosely worded questions.
- **A damage filter, not in the ticket.** Without it, every well-written question about something else ("bagaimana cara membuat kue brownies?") cost a model call, which an existing test caught. `looks_damaged` (`repair.py`) asks for a sign: a word nearly, not exactly, one the rules or documents use (one letter off, or letters left out like "ttk" for "titik"; two letters off only for words of seven letters or more), or a run of 15 letters or more. The first version (distance 2 for every word) matched "cara" with "hari" and "parah". The cost: a question that is damaged in a way that shows none of these signs is not sent to the model.
- **The place check moved.** First done on the rewrite's text, which turned "di rumah" into an unknown place and discarded a good rewrite of a health question. It now runs only when the rules read the rewrite as a count or a ranking (`keeps_the_place`): the area must be the one the person's own words name after code repair, and a place that is unclear in the original is not settled by the model. A rewrite read as anything but a number or a term to explain (a greeting, a clarification, an unknown place) is discarded.
- The cache is the existing `ExplanationCache` under the key `("repair", normalised question)`; it holds the model's plain text, and the checks run again each time because the places can change. A failure is never cached.
- A digit the person wrote may stay in the rewrite; a model that turns "seminggu" into "7 hari" is discarded because the digit is new. That is stricter than needed but safe.
- Not tested with a real model: ticket 06 measures that.
- **Hardened after an automated security review of the pushed branch** (2026-10-29): (1) the rewrite is held to the person's own period, peat and low-confidence filters as well as the place, and a period the map lacks in the person's words is refused with the usual message, because a model that dropped "kemarin" would have answered for the last 24 hours; (2) every word of the rewrite must be a word the chat knows or one the person typed or a slip away from, because the rewrite is shown in the reading note and must not carry the model's own sentence; (3) the vocabulary of the documents is cached until the table changes and looked up at most once per question, the word lists are indexed by first letter, and only the first 80 words of a message are examined. Tests were added for each. The cost: a rewrite that turns "smgu" into "seminggu" is discarded, because the period it implies is not in the person's words.
