# 03: Hybrid retrieval (full-text and meaning)

**What to build:** A person asking an explanation question with a synonym the documents never use ("api di gambut tidak mau padam") gets the right quoted passage instead of "not in our sources", without any answer becoming less safe. Headings are embedded locally and searched by meaning after the existing full-text search. See `spec.md` and ADR 0003.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] A small multilingual embedding model runs inside the API container (ONNX, no separate service) and works with no network after the image is built
- [x] Loading the knowledge documents (at start and with `load-knowledge`) also stores a vector per heading; a malformed document still stops the API from starting
- [x] Retrieval is full-text first, then passages whose heading is close enough in meaning; a passage is shown only if it passes a relevance rule, and "not in our sources" is still the answer otherwise
- [x] The existing evaluation (50 answerable, 19 turned away, every heading findable) passes with no regression, and the medical and personal questions are still turned away
- [x] New synonym questions and close-but-uncovered questions are added to the evaluation
- [x] The relevance rule (similarity of at least 0.85) is set against the evaluation and the result is written to `docs/chatbot.md`
- [x] Without the embedding model the chat still answers by words and nothing breaks
- [x] The panel shows the quoted passage for a synonym question exactly as it does for any quotation (no UI change needed)
- [x] Seam 1 tests cover the above through `POST /chat` with the real documents

**Decision changed while building:** the ticket first said "a custom database image with PostGIS and pgvector". The PostGIS image in use is on Debian 11, whose PostgreSQL package repository no longer has pgvector, and newer PostGIS images would force an extension upgrade on existing databases. With about thirty passages a plain array column compared in the application is enough, so pgvector was dropped for now (ADR 0003).
