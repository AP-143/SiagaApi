# 03: Questions typed without spaces

**What to build:** "adaberapatitikapidikalimantanutara" is read as "ada berapa titik api di kalimantan utara" and answered. See `spec.md` and ADR 0004.

**Blocked by:** 01: A misspelled place is read, and never silently replaced by all of Kalimantan; 02: Typos and short forms in the words the rules look for

**Status:** ready-for-agent

- [ ] A token that is not a known word and is made only of letters is split into vocabulary words by dynamic programming: the fewest pieces, then the longest words; word repair of ticket 02 may apply inside a piece
- [ ] Only the vocabulary is used, so a long run of random letters stays one unknown token and the question stays "not understood"
- [ ] A normal, properly spaced question is never changed by this step
- [ ] The splitting is bounded: it stops on a message past the 500 character limit, and its cost stays small for a message of that length
- [ ] The split text goes through the rules and the place repair of ticket 01; a reply that needed the split carries the reading note ("Saya membaca '...' sebagai 'ada berapa titik api di kalimantan utara'.")
- [ ] Seam 1 backend tests cover: "adaberapatitikapidikalimantanutara", "berapatitikapidikaltengah", "titikapidisambas", "kabupatenmanayangpalingbanyaktitikapinya" (a ranking), "apaituhotspot" (an explanation), a long random run of letters (turned away), a split that can be read two ways (not guessed), and a properly spaced question (no note)
- [ ] The existing chat tests and the knowledge evaluation pass unchanged
