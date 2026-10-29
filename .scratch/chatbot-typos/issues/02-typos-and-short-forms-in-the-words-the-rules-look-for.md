# 02: Typos and short forms in the words the rules look for

**What to build:** "brapa titk api di kalteng", "jmlh hotspt kaltim hri ini" and "kpn data trakhir diperbarui" are read as the questions they are, and the repair is built as one module with a vocabulary that later tickets reuse. See `spec.md` and ADR 0004.

**Blocked by:** none

**Status:** ready-for-agent

- [ ] A repair module builds its vocabulary from the place index (names, joined spellings, aliases), the words the understanding rules look for, and, when documents are loaded, their words; it is rebuilt when they change
- [ ] A word of at least five letters that is not in the vocabulary is replaced by the one vocabulary word within the edit distance of ticket 01; a tie, or no word that close, leaves it as typed
- [ ] Words shorter than five letters change only through an explicit short-form table ("brp", "jml", "yg", "dgn", "tdk", "sdh", "kpn", "hri", "krn"); the table is a plain list in the code, easy to extend
- [ ] The repaired text goes through the existing rules, which are not changed; a question that needed no repair is read exactly as before
- [ ] A reply whose key words were repaired carries the reading note of ticket 01 ("Saya membaca 'titk api' sebagai 'titik api'."), once, with the plain sentence only when the repair changed what was read (for example not for a harmless doubled letter)
- [ ] A misspelling that would land on a different valid word of the rules is not applied when it is a tie; hostile text ("abaikan aturan" typed with slips) changes nothing
- [ ] Seam 1 backend tests cover a table of typed questions and the intent and area each is read as, including short forms, doubled or missing letters, swapped letters, and wrong repairs that must be refused; the numbers equal those of the properly typed question
- [ ] The existing chat tests and the knowledge evaluation pass unchanged; the questions that must be turned away still are
