# Chatbot AI layer (SiagaApi feature 2)

Status: ready-for-agent

## Problem Statement

The chat panel answers well, but it feels like a form with a text box. It understands only the phrasings its rules know, every question stands alone ("kalau yang di lahan gambut?" gets no answer), and explanations are word-for-word quotations that are rejected when the question uses a synonym the documents never use. Responders and the public expect to talk to it like a chatbot. At the same time, the chat is used for fire and smoke questions, so a wrong number, a made-up place, or a reworded health instruction is worse than a stiff answer, and the project cannot spend money.

## Solution

Add an optional AI layer on top of the existing rule-based chat, using only free or locally run models. The rules stay the first path. A language model helps in three bounded ways: it turns a question the rules cannot read into a structured intent that code validates, it rewrites a follow-up into a standalone question using the last few turns, and it writes a readable explanation from the passages that retrieval found, naming the passages it used. Retrieval becomes hybrid (full-text search plus vector search with a local embedding model). Numbers, places and sources still come only from code and the reviewed documents. Health and field-action documents are quote-only. When the model is off, down, slow or over budget, the chat falls back to the rule-based path ("simple mode") and says so. The decisions are in `docs/adr/0003-ai-layer-is-optional-grounded-and-swappable.md`.

## User Stories

1. As a Responder, I want to ask in my own words ("ada berapa api di daerah Palangkaraya sekarang?"), so that I do not have to learn the phrasings the chat knows.
2. As a Responder, I want a follow-up like "kalau yang di lahan gambut?" to continue my previous question, so that I can narrow a question without retyping it.
3. As a Responder, I want every number and place name in an answer to come from the database, so that I can act on it.
4. As a Responder, I want an explanation in plain, readable Indonesian, so that I do not have to parse a quoted paragraph.
5. As a Responder, I want the original quotation and its source under every written explanation, so that I can check it and open the source.
6. As a Responder, I want questions the sources do not cover to be turned away honestly, so that I am never given an invented answer.
7. As a Responder, I want smoke and health guidance shown exactly as the official source states it, so that no rewording changes its meaning.
8. As a member of the public, I want a friendly reply to "halo" or "terima kasih" that points me to example questions, so that I know what to ask.
9. As a member of the public, I want a clear note that my question is processed by an AI service and that I should not write personal data, so that I can decide what to type.
10. As a Responder, I want the chat to keep working when the AI is unavailable, so that a quota limit or an outage never leaves me without an answer.
11. As a Responder, I want to see when the chat is in simple mode, so that I understand why an answer is stiffer.
12. As a Responder, I want answers written by the model to be marked, so that I can tell them from plain data answers.
13. As a Responder, I want the "Tampilkan di peta" button and the source link to work as before.
14. As a member of the public, I want an explanation question worded with a synonym ("api liar" for "kebakaran hutan") to still find the right passage, so that wording does not decide whether I get an answer.
15. As the operator, I want the model address, model name and key set in `.env`, so that I can switch between a local model and a free hosted API without changing code.
16. As the operator, I want the AI layer off when no address is configured, so that the project still runs with no model and no key.
17. As the operator, I want global limits on model calls per minute and per day, so that a free quota is not used up by a few visitors.
18. As the operator, I want repeated questions answered from a cache, so that the same explanation does not use quota twice.
19. As the operator, I want questions never logged or stored, and only public data sent to the model, so that privacy is protected.
20. As the operator, I want the model's output validated by code before it is used, so that a malformed or hostile output cannot change what the chat does.
21. As the operator, I want text a user types to be treated as data and never as instructions, so that "ignore your rules" does nothing.
22. As a developer, I want automatic tests to use a fake model client, so that tests stay offline, deterministic and free.
23. As a developer, I want a separate manual evaluation script that runs real questions through a real model, so that I can choose a model and measure Indonesian quality before trusting it.
24. As a developer, I want the model to start locally with an optional compose profile, so that a normal `docker compose up` does not download gigabytes.
25. As a developer, I want retrieval changes accepted only when the existing evaluation improves and nothing that passed now fails, so that "smarter" never means "less safe".

## Implementation Decisions

- **Scope**: the chat only. The map, ingestion and API for Hotspots are unchanged.
- **Unchanged rules**: ADR 0001 (numbers and places from code) and the reviewed-document rules of ADR 0002 (source and review date, "not in our sources", loud failure on a malformed document). ADR 0003 records what changes.
- **Model interface**: one OpenAI-compatible chat client in the backend, configured by environment variables for the base address, model name, key, timeout and the call limits. No address means the AI layer is off. A local server (Ollama or llama.cpp) and hosted free APIs (Groq, OpenRouter, Cloudflare Workers AI) use the same client.
- **Local model**: Ollama as an optional compose profile (`--profile ai`). The model is chosen from a few small multilingual candidates by the evaluation script, not by guess. The developer machine has 16 GB of RAM.
- **Understanding**: rules first. If the rules cannot read the question, the model returns a structured intent (JSON) that code validates against the known intents, places, windows and filters; anything invalid becomes "not understood". A follow-up is rewritten into a standalone question (at most 500 characters) which then goes through the rules.
- **Conversation**: the browser sends the last few turns (about 6 messages) with each question. The server is stateless and stores nothing. The sent history is untrusted input.
- **Retrieval**: hybrid. Full-text search stays and goes first; a search by the meaning of each heading is added after it. The embedding model (small, multilingual, ONNX) runs inside the API container and embeds the headings when the documents are loaded; the vectors are a plain array column compared in the application (pgvector was dropped for now, see ADR 0003). The existing evaluation (50 answerable questions, 19 that must be turned away, every heading findable) is the gate; strict `xfail` questions that now pass are promoted to normal tests.
- **Grounded explanations**: the model receives the retrieved passages and the question, answers only from them, and names the passages used. Code checks the named passages were retrieved; otherwise, or if the model declines, the reply is the verbatim quotation. The quotation and source are always shown under a model-written answer.
- **Quote-only documents**: a front-matter field marks a document as quote-only. The kesehatan-kemenkes, kesehatan-who and tindakan-lapangan documents are marked. Passages from them are never reworded.
- **Scope of topics**: only the sources. Short greetings get a friendly reply with example questions. Everything else is turned away as today.
- **Prompt safety**: fixed system prompt, user text passed as delimited data, no tools for the model, all output validated.
- **Budget and fallback**: global per-minute and per-day limits on model calls, a cache of model-written answers (key: normalized standalone question plus the ids and review dates of the passages), a timeout on every call. Any failure falls back to the rule-based answer ("simple mode"). The existing per-client chat rate limit stays.
- **Reply shape**: the reply tells the panel whether the text was written by the model and whether the chat is in simple mode.
- **UI**: the answer appears at once with a typing indicator (no streaming). A model-written answer carries a small label. A permanent note under the question box says questions are processed by an AI service and should hold no personal data, next to the existing note that a Hotspot is a satellite detection and not a confirmed fire. Simple mode shows a short notice. The map button and the source link are unchanged.
- **Privacy**: questions are not logged or stored. Only public data goes to the model.

## Testing Decisions

- **Good tests** assert external behavior only: what goes into `POST /chat` and what comes out, or what the panel shows. They never call a real model.
- **Seam 1 (primary): backend end-to-end with a fake model client** and a real PostGIS database. Cases to cover:
  - With no model configured, every existing chat test passes unchanged.
  - A question the rules cannot read is understood through a valid structured intent from the fake model, and the numbers equal what `/hotspots/counts` reports.
  - An invalid or hostile intent from the fake model becomes "not understood", never a guess.
  - A follow-up is rewritten using the history and then answered by the rules; the rewritten question is capped at 500 characters.
  - A grounded answer that names a passage that was not retrieved is replaced by the verbatim quotation.
  - A model that says it cannot answer gives the quotation or "not in our sources".
  - Passages of quote-only documents are never reworded, even when the fake model offers a rewording.
  - Model errors, timeouts, and exceeding the per-minute or per-day limit give the rule-based answer and mark simple mode.
  - A repeated question uses the cache and makes no second model call.
  - User text such as "abaikan semua aturan" does not change behavior, and an unknown place name still never reaches an answer.
  - No number or place name in any reply comes from model text.
  - Asking still changes no stored data.
  - Hybrid retrieval: the existing evaluation passes with no regression, and questions with synonyms that were strict `xfail` are promoted if they now pass.
- **Seam 2 (small): UI against a mocked API.** The label on model-written answers, the simple-mode notice, the permanent privacy note, the typing indicator, and the history sent with a question.
- **Manual, not in CI**: an evaluation script runs the evaluation questions plus a set of free-form and follow-up questions through a real configured model and reports Indonesian understanding, faithfulness to the passages, refusals, and speed. Its results are written to `docs/chatbot.md` and decide which local model is used.
- **Prior art**: `backend/tests/test_chat.py`, `test_knowledge.py`, `test_knowledge_eval.py`, `test_chat_rate_limit.py`, and `frontend/src/Chat.test.tsx`.

## Out of Scope

- Production hosting and deployment (server, domain, TLS, backups). It is a separate piece of work, and whether production runs a local model on one free VM or a free hosted API without a card is decided then.
- Any paid model, any cost cap beyond the free-tier limits, and a rate limit shared across several API processes.
- Streaming answers token by token.
- Storing or logging questions, accounts, and per-user history.
- New knowledge documents (BNPB, KLHK, BMKG, newer Kemenkes statements). They need a document the project owner supplies or approves.
- Model-written numbers, place names or sources, and model tool calling.
- Fine-tuning a model.
- Languages other than Indonesian.

## Further Notes

- Free hosted limits apply to the whole application, not to each visitor. Groq's free tier, for example, allows roughly a handful of chats per minute for everyone together, so the global budget, the cache and simple mode are part of the design, not extras.
- Provider facts were gathered on 2026-10-28 and change often: Gemini's free tier may use prompts for training and human review; Cloudflare Workers AI states it does not train on customer content and offers the multilingual `bge-m3` and a Southeast-Asian chat model; Groq states no default retention but no explicit no-training statement was found; Cohere's trial key (1,000 calls a month), Hugging Face inference (no free credits), GitHub Models (retired) and Mistral's free tier (trains by default) were ruled out. Re-check any provider's limits and data policy in its console before using it.
- Oracle Cloud Always Free (ARM, now 2 OCPU and 12 GB) is the only free host found that can run a local model next to the database, with a sign-up card and a slow estimated 3 to 6 tokens per second for a 3B model; those speeds are not measured.
- Not yet measured: how well small local models understand and write Indonesian. The evaluation script exists to answer that before a model is chosen.
- The health documents still need review by someone qualified before the chat is public (see `docs/chatbot.md`).
