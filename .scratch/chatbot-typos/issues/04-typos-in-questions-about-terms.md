# 04: Typos in questions about terms

**What to build:** "gmbut itu apa" and "apakah gambut bisa terbakar sndiri" find the reviewed explanation, and a misspelled health question gets the reviewed passage word for word. See `spec.md` and ADR 0004.

**Blocked by:** 02: Typos and short forms in the words the rules look for

**Status:** ready-for-agent

- [x] Knowledge retrieval repairs the question with the vocabulary of ticket 02 (which includes the words of the loaded documents) before it runs full-text and meaning search; the threshold of 0.85 for meaning search is not lowered
- [x] A check whether `pg_trgm` is installed in the project's database image decides how character similarity is done: with `pg_trgm`, a trigram search over the document words; without it, a comparison against the vocabulary in the application. The choice and the reason are recorded in the ticket's comments
- [x] A misspelled term question is answered from the same passage as the properly typed one, with the reading note of ticket 01
- [x] Quote-only documents are still only ever shown word for word, also for a misspelled question; the model is never asked to reword them
- [x] A misspelled question about something the documents do not cover is still "not in our sources"
- [x] Seam 1 backend tests cover: "gmbut itu apa", "apakah gambut bisa terbakar sndiri", "apa itu hotspt", a misspelled smoke or health question (verbatim quotation), and a misspelled question outside the documents (turned away)
- [x] The knowledge evaluation in `test_knowledge_eval.py` still passes: answerable questions answered, the questions that must be turned away still turned away, and no strict `xfail` regressed

## Comments

- `pg_trgm` is installed in the database image (v1.6), but the comparison is done in the application anyway: the chat's other repairs (rule words, place names) use the same edit distance with the same limits, a question then needs one rule for "how near is near", and the document words (a few hundred) are cheap to compare. A trigram index would give a second, differently-tuned notion of similarity.
- `document_words(conn)` returns the words of at least four letters from the headings and bodies of the loaded passages. Only a question that asks for an explanation (the word may itself be misspelled, "apakh") is repaired with them, and the repaired text is what gets searched; the reply carries the reading note.
- Lesson: the first version turned "susah" into "sudah" in "kenapa tanah gambut susah dimatikan apinya?" and lost the passage. A word that is exactly one substituted letter from a known word ("susah"/"sudah", "bulat"/"bulan", "kapal"/"kapan") is now never a repair candidate, because both are real words. A missing, extra or swapped letter is still repaired. The cost: a typo that is only a wrong letter ("maskes") is not repaired.
- A question that asks for an explanation is never read as a count after a repair; this check also uses the repaired question-word now, so "apakh anak bleh pakai maskr" is handled as a question about a term.
