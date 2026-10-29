# 04: Typos in questions about terms

**What to build:** "gmbut itu apa" and "apakah gambut bisa terbakar sndiri" find the reviewed explanation, and a misspelled health question gets the reviewed passage word for word. See `spec.md` and ADR 0004.

**Blocked by:** 02: Typos and short forms in the words the rules look for

**Status:** ready-for-agent

- [ ] Knowledge retrieval repairs the question with the vocabulary of ticket 02 (which includes the words of the loaded documents) before it runs full-text and meaning search; the threshold of 0.85 for meaning search is not lowered
- [ ] A check whether `pg_trgm` is installed in the project's database image decides how character similarity is done: with `pg_trgm`, a trigram search over the document words; without it, a comparison against the vocabulary in the application. The choice and the reason are recorded in the ticket's comments
- [ ] A misspelled term question is answered from the same passage as the properly typed one, with the reading note of ticket 01
- [ ] Quote-only documents are still only ever shown word for word, also for a misspelled question; the model is never asked to reword them
- [ ] A misspelled question about something the documents do not cover is still "not in our sources"
- [ ] Seam 1 backend tests cover: "gmbut itu apa", "apakah gambut bisa terbakar sndiri", "apa itu hotspt", a misspelled smoke or health question (verbatim quotation), and a misspelled question outside the documents (turned away)
- [ ] The knowledge evaluation in `test_knowledge_eval.py` still passes: answerable questions answered, the questions that must be turned away still turned away, and no strict `xfail` regressed
