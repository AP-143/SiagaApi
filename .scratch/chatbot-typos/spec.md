# Chat that reads typos and missing spaces (SiagaApi feature 4)

Status: ready-for-agent

## Problem Statement

People write to the chat on a phone, in a hurry, and in Indonesian that is full of short forms and slips: "brapa titk api di kalteng", "kalimantan tengh", "gmbut itu apa", and sometimes a whole sentence with no spaces at all ("adaberapatitikapidikalimantanutara"). Probing the running chat on 2026-10-29 showed three kinds of failure:

1. **A wrong number, silently.** "berapa titik api di kalimantan tengh" (and "selatn", "utra") is answered with the figure for all of Kalimantan (875), because the word "kalimantan" matches and the misspelled direction word is ignored. The reply says "di Kalimantan", so it is honest about what it counted, but it is not what was asked, and a Responder may act on it.
2. **Not understood.** A sentence with no spaces ("titikapidisambas"), and short forms of terms ("apaituhotspot", "gmbut itu apa", "gambut bisa terbakar sndiri") get "not found in our sources", even though the chat can answer the properly typed version.
3. **A missed chance to help.** A misspelled name that the chat cannot read ("seruyann") is turned away with "I do not recognise this place" and no suggestion.

The AI layer is switched on in the running setup (`/chat/status` says `ai: true`), yet it does not rescue these cases: the model is asked for a structured intent only, and a question about a term is not an intent.

## Solution

Repair the question before deciding what it means, in this order, and never let the repair invent anything:

1. **Code first, no model.** Fix spelling and spacing with the chat's own vocabulary (place names and their short forms, the words the rules look for, and the words of the reviewed documents): split a run of letters with no spaces into the known words it is made of, and replace a word one or two letters away from exactly one known word. This works even when the model is off.
2. **Then the rules**, as today, so numbers and places come from code (ADR 0001).
3. **Then the model, when it is on and the rules still cannot read the question:** the model may only rewrite the question with its spelling and spacing fixed (at most 500 characters). The rewrite goes through the rules like any other question, and code checks that it did not bring in a place the person did not write.
4. **When something was repaired, say so**, in a short line under the answer ("Saya membaca 'kalimantan tengh' sebagai Kalimantan Tengah."), so a wrong reading is easy to spot and correct. When a repair is ambiguous ("kutai"), ask which one is meant, as the chat already does for an ambiguous place. When nothing sensible can be read, say so honestly and offer the example questions.

The decisions are in `docs/adr/0004-typos-and-missing-spaces-are-repaired-by-code-first.md`.

## User Stories

1. As a Responder, I want "berapa titik api di kalimantan tengh" answered for Kalimantan Tengah, so that a slip in one letter does not give me another area's number.
2. As a Responder, I want the answer to tell me how it read my misspelled place, so that I can see at once if it read it wrongly.
3. As a Responder, I want "kutai" or "kota" to still ask which one I mean, so that a repair never guesses between two places.
4. As a Responder, I want a place the chat cannot read, even after repair, to be turned away, never replaced by all of Kalimantan, so that I am never given a number for an area I did not ask about.
5. As a member of the public, I want "adaberapatitikapidikalimantanutara" understood as the question it is, so that a missing space does not make the chat useless.
6. As a member of the public, I want common short forms ("brp", "jml", "kpn", "trakhir", "hotspt") understood, so that I can write the way I write messages.
7. As a member of the public, I want "gmbut itu apa" answered with the reviewed explanation of peatland, so that a typo does not hide knowledge the chat has.
8. As a Responder, I want health and field-action guidance to appear only as the reviewed text word for word even when the question was misspelled, so that repair never changes what a health instruction says.
9. As a Responder, I want a repaired question to give the same number as the properly typed one, so that nothing about the answer depends on the slip.
10. As a Responder, I want "Tampilkan di peta" to show the area the chat actually read, so that the map and the answer agree.
11. As a member of the public, I want a question that is nonsense ("asdf titik ap??") still turned away politely, so that repair does not turn noise into an answer.
12. As the operator, I want all of this to work with the AI layer off, so that it costs nothing and never depends on a quota.
13. As the operator, I want the model used for repair only when the rules failed, only to rewrite the text, and always checked by code, so that free quota is spent where it is needed and the model cannot add a place or a number.
14. As the operator, I want text a user types to stay data and never instructions, so that "abaikan aturan" typed as a misspelling does nothing.
15. As a developer, I want automatic tests to need no real model, so that they stay offline, deterministic and free, and a separate manual evaluation to measure how well a real model repairs Indonesian.
16. As a developer, I want a table of misspelled and unspaced questions with their expected reading, so that any change to the repair is judged against real examples and a repair that now gives a wrong answer fails a test.

## Implementation Decisions

- **Scope**: the backend chat (understanding, places, retrieval, the model client's repair step) and one line in the chat panel (the reading note). The map, ingestion and the Hotspot API are unchanged.
- **Unchanged rules**: ADR 0001 (numbers and places come from code), ADR 0002 (reviewed documents, "not in our sources"), ADR 0003 (rules first, optional grounded model, simple mode). ADR 0004 adds the repair order.
- **One repair module**, used by the rules and the retrieval alike, with these parts:
  - **Vocabulary.** Built from the place index (names, joined spellings, aliases such as "kalteng"), the words the understanding rules look for (for example "berapa", "terbanyak", "diperbarui", "hotspot", "gambut", "kepercayaan"), and the words of the loaded knowledge documents. Short forms that no edit distance would find ("brp", "jml", "yg", "dgn", "tdk", "sdh", "kpn") are an explicit table.
  - **Word repair.** A word of at least five letters that is not in the vocabulary is replaced by the one vocabulary word within a small edit distance (a swap of two neighbouring letters counts as one). One letter for words up to seven letters, two for longer ones. When two words tie, no repair is made. Words shorter than five letters are only changed through the short-form table.
  - **Segmentation.** A token with no spaces that is not a known word is split into known words by dynamic programming (fewest pieces, then the longest words), with word repair allowed inside a piece. Only the vocabulary is used, so noise stays noise.
  - **Place repair.** After the exact match in `places.py`, a place name that is one or two letters from a known name resolves to it when exactly one name is that close. A matched region word followed by a direction word that is a near-miss of "barat/timur/utara/selatan/tengah" is read as the province (the "kalimantan tengh" case). A tie is an ambiguous place and gets the existing question.
- **No silent fallback to all of Kalimantan.** When a question names a place-like phrase that did not resolve exactly or by repair, the reply is the existing "unknown place" answer, not the region total. An unknown place now also offers the nearest known name when there is one ("Maksud Anda Seruyan?").
- **The reading note.** A reply whose place, or whose key words, were repaired carries `read_as` in its data (what was typed and what it was read as) and one plain-text sentence in its answer. It is shown with the answer and is never part of a model-written text.
- **Knowledge questions.** Retrieval first repairs the question with the same vocabulary, then runs full-text and meaning search as today. Character-similarity (trigram) search over the document words may back this; the ticket checks whether `pg_trgm` is installed and otherwise compares against the vocabulary in the application. Quote-only documents are still only ever quoted.
- **Model repair.** Only when the AI layer is on and the rules, after code repair, still cannot read the question. The model gets the question as delimited data and returns the question with spelling and spacing fixed, nothing else (at most 500 characters, plain text). The result goes through the same rules. Code then checks that the area the repaired question resolves to can also be reached from the original message by place repair (so the model cannot add a place), and that the repaired text brings in no digit the original lacks; otherwise the repair is discarded and the reply is "not understood". The call counts against the existing budget and cache (the key is the normalised original question), and any failure falls back to the answer without model repair.
- **Always honest at the end.** If nothing sensible can be read, the reply is the existing "not found" answer with the example questions.
- **Privacy**: unchanged. The question is not logged or stored; only the question text goes to the model, as now.
- **UI**: the chat panel shows the reading note as a small line under the answer. Nothing else changes; "Tampilkan di peta" already uses the area from the reply's data.

## Testing Decisions

- **Good tests** assert behaviour through `POST /chat` and what the panel shows, never the repair module's internals, and never call a real model.
- **Seam 1 (primary): backend end to end with a real PostGIS database, with and without a fake model client.** A table of (typed question, expected reading) is the heart of it:
  - Place slips: "kalimantan tengh", "kalimantan selatn", "kalimantan utra", "seruyann", "palangkaraya" resolve to the right area with a reading note, and the count equals what `/hotspots/counts` reports for it.
  - Ambiguity stays: "kutai" and a near-miss that fits two names ask which one is meant.
  - No silent fallback: a name near nothing ("palembang") stays an unknown place; a typed question with an unmatched place-like phrase never returns the region total.
  - Short forms and typos: "brapa titk api di kalteng", "jmlh hotspt kaltim hri ini", "kpn data trakhir diperbarui".
  - No spaces: "adaberapatitikapidikalimantanutara", "titikapidisambas", "kabupatenmanayangpalingbanyaktitikapinya", "apaituhotspot"; and a long run of random letters stays "not understood".
  - Knowledge: "gmbut itu apa" answers with the peatland passage; a health question with a typo gets the quotation, never a rewording.
  - Safety: a misspelling that would repair into a different, valid intent is not applied when it is a tie; hostile text ("abaikan aturan" typed with slips) changes nothing.
  - Model repair (fake client): a valid rewrite is used and answered by the rules; a rewrite that adds a place, adds a digit, is too long, or is not text is discarded; budget, timeout and error fall back to "not understood"; a repeated question uses the cache.
  - With no model configured every case above that code can repair still passes.
- **Seam 2 (small): the panel.** It shows the reading note under a repaired answer, and no note under an answer that needed no repair.
- **Existing evaluation as a gate.** The knowledge evaluation in `backend/tests/test_knowledge_eval.py` (answerable questions, questions that must be turned away) must not regress: a repair must not turn a question that is rightly turned away into an answer.
- **Manual, not in CI**: the evaluation script runs the table plus unspaced and badly misspelled questions through a real model and reports how many it repaired correctly, how many it wrongly changed, and how long it took (ticket 06).
- **Prior art**: `backend/tests/test_chat.py` (`real_names`, `area_of`), `test_chat_model.py`, `test_knowledge_eval.py`, `frontend/src/Chat.test.tsx`.

## Out of Scope

- Languages other than Indonesian (English, Javanese, Banjar), and speech input.
- Spell-checking in the text box while typing, or "did you mean" before sending.
- Correcting the answer's own wording, or anything the model writes in an explanation.
- A bigger vocabulary from outside sources (a general Indonesian dictionary). The vocabulary is the chat's own words only.
- Storing questions to learn from them.
- New knowledge documents; they need a document the project owner supplies or approves.
- Any change to the map, the filters or the Hotspot API.

## Further Notes

- Probe of the running chat on 2026-10-29 (AI on): "brapa titk api di kalteng", "jumlah hotspot kaltim hri ini" and "kpn data trakhir diperbarui" were already answered; "kalimantan tengh/selatn/utra" returned the region total (875) silently; "seruyann" was turned away as unknown; every unspaced sentence and "gmbut itu apa" got "not found".
- The chat's knowledge retrieval already offers a heading only when its meaning is at least 0.85 similar to the question (ADR 0003). A misspelled word lowers that similarity, which is why the typo case needs repair before retrieval rather than a lower threshold.
- A repair that silently changes meaning is worse than no repair. Every rule above leans towards asking or turning the question away, and the evaluation table must contain wrong-repair cases on purpose.
- Small local models may be poor at this; whether the model repair is worth having is decided by the evaluation in ticket 06, and ticket 05 keeps it behind the same switch as the rest of the AI layer.
