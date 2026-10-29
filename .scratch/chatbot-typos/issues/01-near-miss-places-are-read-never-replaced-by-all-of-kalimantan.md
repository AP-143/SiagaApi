# 01: A misspelled place is read, and never silently replaced by all of Kalimantan

**What to build:** A Responder who types "berapa titik api di kalimantan tengh" gets the figure for Kalimantan Tengah, with a line saying how the place was read. A name the chat cannot read is turned away, never answered with the total for all of Kalimantan. See `spec.md` and ADR 0004.

**Blocked by:** none

**Status:** ready-for-agent

- [x] After the exact match, a place name one or two letters from exactly one known name (a swap of two neighbouring letters counts as one) resolves to it: "seruyann", "palangkaraya", "singkawng"; one letter for names up to seven letters, two for longer ones
- [x] A matched region word followed by a near-miss of a direction word is read as the province: "kalimantan tengh", "kalimantan selatn", "kalimantan utra" resolve to Kalimantan Tengah, Selatan and Utara
- [x] A tie between two names is the existing ambiguous-place question, not a guess ("kutai" stays ambiguous)
- [x] A question that names a place-like phrase which does not resolve, exactly or by repair, gets the existing "unknown place" reply and never the region total; the reply offers the nearest known name when there is one
- [x] A reply whose place was repaired carries `read_as` (what was typed, what it was read as) in its data and one plain-text sentence in its answer: "Saya membaca 'kalimantan tengh' sebagai Kalimantan Tengah."; a reply that needed no repair has neither
- [x] The count in a repaired reply equals what `/hotspots/counts` reports for the same area and window as a properly typed question
- [x] The chat panel shows the reading note as a small line under the answer, as plain text; "Tampilkan di peta" uses the area from the reply's data
- [x] Seam 1 backend tests (real PostGIS) cover: each slip above with its reading note and its count; "kutai" ambiguous; "palembang" and a random word still unknown; the ordinary word "baru" is not mistaken for a place; a properly typed question has no note
- [x] Seam 2 frontend tests cover: the note appears under a repaired answer and not under a plain one
- [x] The existing chat tests and the knowledge evaluation pass unchanged
