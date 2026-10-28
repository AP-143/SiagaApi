# 04: Grounded explanations, quote-only documents and cache

**What to build:** For an explanation question, the Responder reads a short answer in plain Indonesian written by the model from the retrieved passages only, with the verbatim quotation and its source always under it and a small label saying the text was written by AI. Health and field-action documents are never reworded. Repeated questions are answered from a cache. See `spec.md` and ADR 0003.

**Blocked by:** 01: Free-form questions understood by the model; 03: Hybrid retrieval

**Status:** ready-for-agent

- [x] A document front-matter field marks a document as quote-only; the kesehatan-kemenkes, kesehatan-who and tindakan-lapangan documents are marked, and the loader validates the field
- [x] The model receives the question and the retrieved passages and returns an answer that names the passages it used (structured output)
- [x] Code checks every named passage was among the retrieved ones; a failed check, a malformed output, or a "cannot answer" gives the verbatim quotation exactly as today
- [x] Passages from quote-only documents are never sent for rewording, even when the model is available
- [x] The sources shown come from the documents, never from the model; no number, place name or date in model-written text is trusted as data
- [x] The reply says when it contains model-written text; the quotation and source data are always present
- [x] A cache keyed by the normalized standalone question and the ids and review dates of the passages used avoids a second model call for a repeated question; changing a document invalidates the entry
- [x] Questions and model output are not logged or stored; logs say only that a call failed or was skipped, and why
- [x] The panel shows a small label (Indonesian) on answers with model-written text, with the quotation and source link under it; data answers and pure quotations carry no label
- [x] Seam 1 tests with the fake client cover: a good grounded answer, a passage that was not retrieved, a refusal, malformed output, a quote-only passage offered a rewording, a hostile question, a repeated question making one model call, a document change invalidating the cache, and no question text in the logs
- [x] Seam 2 tests cover the label and the quotation under it
