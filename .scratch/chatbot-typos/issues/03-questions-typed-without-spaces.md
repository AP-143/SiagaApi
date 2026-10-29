# 03: Questions typed without spaces

**What to build:** "adaberapatitikapidikalimantanutara" is read as "ada berapa titik api di kalimantan utara" and answered. See `spec.md` and ADR 0004.

**Blocked by:** 01: A misspelled place is read, and never silently replaced by all of Kalimantan; 02: Typos and short forms in the words the rules look for

**Status:** ready-for-agent

- [x] A token that is not a known word and is made only of letters is split into vocabulary words by dynamic programming: the fewest pieces, then the longest words; word repair of ticket 02 may apply inside a piece
- [x] Only the vocabulary is used, so a long run of random letters stays one unknown token and the question stays "not understood"
- [x] A normal, properly spaced question is never changed by this step
- [x] The splitting is bounded: it stops on a message past the 500 character limit, and its cost stays small for a message of that length
- [x] The split text goes through the rules and the place repair of ticket 01; a reply that needed the split carries the reading note ("Saya membaca '...' sebagai 'ada berapa titik api di kalimantan utara'.")
- [x] Seam 1 backend tests cover: "adaberapatitikapidikalimantanutara", "berapatitikapidikalteng", "titikapidisambas", "kabupatenmanayangpalingbanyaktitikapinya" (a ranking), "apaituhotspot" (an explanation), a long random run of letters (turned away), a split that can be read two ways (not guessed), and a properly spaced question (no note)
- [x] The existing chat tests and the knowledge evaluation pass unchanged

## Comments

- The tests use "berapatitikapidikalteng": the vocabulary has "kalteng" but not a half-misspelled "kaltengah". Repairing a word inside a piece is left for a later improvement, because it would widen what can be read from noise.
- A question that asks for an explanation is repaired only to find its document again, never to read it as a count (see ticket 02's comments); an unspaced question has no explanation word to begin with, so it is read by the rules as well.
- `segment()` is also tested on its own (`tests/test_repair.py`): ties, a message at the 500 character limit, and letters that are not made of known words.
