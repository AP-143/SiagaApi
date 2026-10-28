# 06: Model evaluation and choice of the local model

**What to build:** A manual script runs real questions through a real configured model and reports how well it understands and writes Indonesian, how faithful it is to the passages, whether it refuses what it should, and how fast it is. The result decides which local model the project recommends. It is not part of CI. See `spec.md` and ADR 0003.

**Blocked by:** 01: Free-form questions understood by the model; 02: Follow-up questions; 04: Grounded explanations, quote-only documents and cache

**Status:** ready-for-agent

- [x] A CLI command runs the questions from `test_knowledge_eval.py` plus a set of free-form, follow-up, greeting and hostile questions through the configured model and prints a report; it never runs in CI
- [x] The report states, per question, the intent or passage chosen, whether the grounding check passed, whether a refusal was correct, and the time taken, plus a summary per model
- [x] At least two or three small multilingual local candidates are compared on the same questions, and one hosted free option too if a key is available
- [x] The results, the chosen default model, and the limits found (speed, Indonesian quality, memory use) are written to `docs/chatbot.md`
- [x] The limits and data policy of any hosted option used are re-checked in its console and recorded with the date (not applicable: no hosted option was used or measured)
- [x] The script stores no question text or model output except the report that the person runs it for
