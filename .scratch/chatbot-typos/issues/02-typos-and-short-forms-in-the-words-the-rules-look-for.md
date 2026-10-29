# 02: Typos and short forms in the words the rules look for

**What to build:** "brapa titk api di kalteng", "jmlh hotspt kaltim hri ini" and "kpn data trakhir diperbarui" are read as the questions they are, and the repair is built as one module with a vocabulary that later tickets reuse. See `spec.md` and ADR 0004.

**Blocked by:** none

**Status:** ready-for-agent

- [x] A repair module builds its vocabulary from the place index (names, joined spellings, aliases), the words the understanding rules look for, and, when documents are loaded, their words; it is rebuilt when they change
- [x] A word of at least five letters that is not in the vocabulary is replaced by the one vocabulary word within the edit distance of ticket 01; a tie, or no word that close, leaves it as typed
- [x] Words shorter than five letters change only through an explicit short-form table ("brp", "jml", "yg", "dgn", "tdk", "sdh", "kpn", "hri", "krn"); the table is a plain list in the code, easy to extend
- [x] The repaired text goes through the existing rules, which are not changed; a question that needed no repair is read exactly as before
- [x] A reply whose key words were repaired carries the reading note of ticket 01 ("Saya membaca 'titk api' sebagai 'titik api'."), once, with the plain sentence only when the repair changed what was read (for example not for a harmless doubled letter)
- [x] A misspelling that would land on a different valid word of the rules is not applied when it is a tie; hostile text ("abaikan aturan" typed with slips) changes nothing
- [x] Seam 1 backend tests cover a table of typed questions and the intent and area each is read as, including short forms, doubled or missing letters, swapped letters, and wrong repairs that must be refused; the numbers equal those of the properly typed question
- [x] The existing chat tests and the knowledge evaluation pass unchanged; the questions that must be turned away still are

## Comments

- The vocabulary of this ticket is the place words and the words the rules look for. The words of the reviewed documents join it in ticket 04, where retrieval needs them.
- A first version applied every repair, and the knowledge evaluation caught the danger at once: "berada" (an ordinary word) is one letter from "berapa", so the heading "Bagaimana SiagaApi menentukan sebuah titik api berada di lahan gambut?" became a count. The repaired reading is now accepted only when it is a count, a ranking or a freshness question, when the person did not ask for an explanation, and when it reads differently from the original. Two regression tests keep this ("berada", and "bulat" next to "bulan").
- A question the rules already read as typed is left alone, so a repair never changes a reading that needed none.
