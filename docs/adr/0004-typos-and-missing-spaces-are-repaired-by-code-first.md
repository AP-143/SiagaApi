# Typos and missing spaces are repaired by code first, then by the model, and a repair is always shown

Status: accepted

People write to the chat quickly and in short forms, and sometimes without spaces. The chat reads a question with rules (ADR 0003) and falls back to "not found". Probing it showed that a one-letter slip in a place name ("kalimantan tengh") gave the figure for all of Kalimantan instead of the province, and that unspaced sentences and misspelled terms were turned away. This ADR decides how the chat copes without weakening ADR 0001 (numbers and places come from code).

## Decisions

1. **Repair before reading, in this order.** (a) Code repairs spelling and spacing with the chat's own vocabulary. (b) The rules read the repaired question as before. (c) Only if the AI layer is on and the rules still cannot read it, the model may rewrite the question with its spelling and spacing fixed, and that rewrite goes through the rules too. The first step works with the model off.
2. **The vocabulary is the chat's own words**: place names, their joined spellings and short forms, the words the understanding rules look for, and the words of the reviewed documents. Anything outside it is not "repaired" into something else, so noise stays noise.
3. **A repair never guesses between two.** A word is replaced only by the single vocabulary word within a small edit distance (one letter for short words, two for longer ones); a tie is no repair, and for a place a tie is the existing ambiguous-place question.
4. **No silent fallback to all of Kalimantan.** A question that names a place-like phrase which did not resolve, exactly or by repair, is turned away as an unknown place (with the nearest known name offered when there is one). The region total is given only when no place was named.
5. **A repair is always visible.** When a place or key words were repaired, the reply says how it read them in one plain sentence ("Saya membaca 'kalimantan tengh' sebagai Kalimantan Tengah.") and carries the same in its data. It is never part of model-written text.
6. **The model only rewrites, and code checks the rewrite.** It receives the question as delimited data and returns the question text with spelling and spacing fixed, at most 500 characters. The rewrite is read by the rules. It is discarded if the area it resolves to cannot also be reached from the original message by place repair, if it contains a digit the original lacks, or if it is not plain text of a sensible length. The model never supplies a place, a number or an intent; ADR 0003's structured-intent path is unchanged.
7. **Quote-only documents stay quote-only.** Repairing a misspelled health or field-action question only finds the reviewed passage; it is still shown word for word.
8. **Cost and failure.** The model repair uses the existing per-minute and per-day budget and the cache (keyed by the normalised original question). Any model error, timeout or budget limit gives the answer the rules alone would give, and the reply never fails only because the repair did.
9. **Tests need no real model.** A table of misspelled and unspaced questions with their expected reading, including repairs that must be refused, is the main test, with and without a fake model client. A manual evaluation measures a real model's repairs and wrong repairs.

## Considered options

- **Model only.** Rejected: it fails when the model is off, down or over budget, uses quota for questions code can fix, and a model that corrects a place name is a model supplying a place (ADR 0001).
- **Lower the retrieval threshold so typos still match.** Rejected: ADR 0003 set 0.85 with a thin margin against questions the documents do not answer (0.80); lowering it would start answering those. Repair the word, not the threshold.
- **Always ask "did you mean ...?" first.** Rejected as the default: one extra round trip for every slip is tedious on a phone, and the visible reading note makes a wrong reading easy to spot. It is used where a repair is ambiguous.
- **A general Indonesian dictionary.** Rejected for now: it would turn more noise into plausible words, and the chat's own vocabulary already covers what it can answer.

## Consequences

- A repaired question can still be read wrongly (a typo that lands on a different valid word). That is the reason for the reading note, for the tie rule, and for wrong-repair cases in the evaluation table.
- The vocabulary has to be kept in step with the rules and the documents: a new rule word or a new document word is available to repair as soon as it is loaded, but a new short form must be added to the table by hand.
- The model repair is optional and may turn out not to be worth it with a small local model; the evaluation decides, and removing it leaves steps (a) and (b) intact.
- ADR 0003 is unchanged: the rules are still first, the model is still second, numbers and places still come from code.
