# The chat explains by quoting reviewed documents, found with full-text search first

Status: accepted

People ask the chat things the database cannot answer: what a Hotspot is, what Confidence means, why peat fires are hard to put out. For those questions the answer is a passage of a reviewed document, quoted word for word with its source and the date we reviewed it. Nothing is paraphrased, so the chat cannot say more than the document says, and a passage that does not fit well enough is not shown: the answer is then "not in our sources" instead of the nearest-looking text.

Passages are found with PostgreSQL full-text search (the `indonesian` configuration, which stems but keeps function words, so we drop those ourselves). A passage is shown only if it covers at least 70% of the meaningful words in the question; ties go to the passage whose title is closest to the question. There is no embedding model and no vector store yet.

## Considered options

- **Vector search with an embedding model now.** Deferred, not rejected. It needs a different database image (pgvector) and an embedding source: a paid or key-requiring API, or a local model, and the project owner chose to install nothing on their machine. Buying that for a knowledge base of about two dozen passages would be paying for a problem we had not measured. The evaluation in `backend/tests/test_knowledge_eval.py` (50 questions against the real documents) is how we will know: when real questions start missing because of wording (synonyms the documents never use), that is the evidence for vectors.
- **A language model that writes the explanation from retrieved passages.** Rejected for now: it can add claims the source does not make, and these answers concern fire safety. A model may later help choose a structured intent (ADR 0001) but should not write the explanation.
- **Writing safety or health advice ourselves.** Not done. The documents contain only what a source states. Smoke and health guidance is a restatement of two official sources (Kemenkes and WHO Europe), each named on every answer, and the chat says it is not personal medical advice and points to the local authorities.

## Consequences

- Every document carries a source and a `reviewed` date (the day we last checked it against the source, not when the source was published). A document without them, or with a malformed date or address, stops the API from starting: that is deliberately louder than a chat that silently answers from a half-loaded knowledge base.
- Questions that use words the documents never use will be turned away even if the document answers them. That is accepted for now and is what the evaluation watches.
- Which words count as meaningful (`STOPWORDS`) and the 60% threshold were tuned against the evaluation. The threshold went from 60% to 70% when health documents arrived: with 60%, a three-word question needed only two matching words, and "how do I make a map?" was answered with how to make a smoke-safe room. Weakening it to 50% fails 11 tests. Retune them against the evaluation, not by feel.
- User questions are not stored. Logging unanswered questions to find gaps would be useful but is a privacy decision to make on its own, with opt-in.
