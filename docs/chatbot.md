# Chatbot

Status: **data questions, the chat panel, a stricter chat rate limit, explanations quoted from reviewed documents, and an optional AI layer are done.** The chat works on rules and full-text search alone; a language model, when configured, makes it understand looser wording, follow up on the previous question, and explain in its own words. See `docs/adr/0001-chatbot-numbers-come-from-code.md`, `docs/adr/0002-chat-explains-by-quoting-reviewed-documents.md` (partly superseded) and `docs/adr/0003-ai-layer-is-optional-grounded-and-swappable.md` for why it is built this way, and the section "The AI layer" below for how it behaves.

## The chat panel

The "Tanya" panel (right column; on a phone it takes the place of the other panels) is closed to begin with. It opens with a greeting and four example questions that can be tapped.

- Enter sends, Shift+Enter writes a new line; a question is at most 500 characters, like the server accepts.
- Answers are shown as plain text with their line breaks, never as HTML.
- When a place is ambiguous the choices appear as buttons; tapping one adds the name to the original question, so its time window and filters are kept.
- A server error, a network failure, or being rate limited (with the wait time from `Retry-After`) each get a plain explanation, and the conversation carries on.
- The conversation lives only in the page; a reload starts fresh and nothing is stored.
- The summary beside it behaves the same way when its numbers cannot be loaded: with nothing to show it says so ("Tidak dapat memuat ringkasan") instead of claiming there are no Hotspots, and after a failed refresh it keeps the last numbers with a note that they may be old, but only while the filters are unchanged.
- Reading order: a question just sent scrolls the log to the bottom (with the wait under it); an answer scrolls to its first line, not its last, so a long quotation is read from the start.
- A quoted answer is set like a quotation, not a speech bubble: the text with a rule on its left, then the source line apart under a hairline with the **Buka sumber** link beside it. Questions are small labels on the right. The standing note (a Hotspot is a satellite detection, not a confirmed fire) sits under the question box so the conversation gets the room.
- **"Tampilkan di peta"**: a count or ranking answer carries a button that sets the map to the same view: place (a Regency also selects its Province), time window, peat only and low confidence. The answer data includes the Province code of a Regency for this. Answers that are not about a view (freshness, clarifying questions, refusals) get no button, and neither does one with a window the map does not offer, so the button can never set a different view from the one the answer described. Each answer keeps its own button. On a phone the panels close afterwards so the map is visible; on a wide screen the chat stays open.

Real-browser checks (not covered by the automatic tests, which cannot measure layout) found and fixed three layout problems: the panel not shrinking and pushing the page into scrolling, being squeezed to nothing by the summary beside it, and the question box being clipped at the bottom. The layout is now verified at 360x640, 390x760, 700x760 and 1100x600.

## What it answers today

`POST /chat` with `{"message": "..."}` (1 to 500 characters) returns `{kind, answer, data}`.

| Question like | `kind` | Notes |
| --- | --- | --- |
| "Berapa titik api di Kalimantan Tengah hari ini?" | `count` | Province, Regency, or all of Kalimantan; 24 jam, 48 jam, 7 hari; "di lahan gambut"; "termasuk kepercayaan rendah" |
| "Kabupaten mana yang paling banyak titik apinya?" | `ranking` | Regencies, or Provinces when the question says "provinsi"; top 5 |
| "Kapan data terakhir diperbarui?" | `freshness` | Says when data is stale or has never been updated |
| "titik api di Kutai?" | `clarify` | Asks which one instead of guessing |
| "titik api di Jakarta?" | `unknown_place` | Only the five Kalimantan Provinces and their Regencies are known |
| "bulan lalu", "kemarin" | `unsupported_window` | The map only offers 24 jam, 48 jam and 7 hari |
| "Apa itu hotspot?", "Kenapa gambut sulit dipadamkan?" | `knowledge` | A passage of a reviewed document, word for word, with its source (see below) |
| anything else, e.g. "bagaimana cuaca besok?" | `unsupported` | "Not in the sources I have", plus suggested questions in `data.suggestions` |

Every count answer states the window, whether low-Confidence detections are included, when the data was last updated (WIB), and that a Hotspot is a satellite detection and not a confirmed fire. Numbers use Indonesian separators (`3.295`); `data` keeps plain numbers.

Telling a count question from an explanation: a question that asks "berapa", "jumlah" or "banyak" is a count; one that asks "apa", "kenapa", "mengapa", "siapa", "seberapa", "arti" and so on is an explanation, wherever the word sits ("titik panas itu apa sih?"). A strong explanation word beats "jumlah" ("apa arti jumlah titik api per kabupaten?"), but never "berapa".

## Explanations from reviewed documents

`knowledge` replies are written from the Markdown files in `backend/knowledge/` (change the folder with `KNOWLEDGE_DIR`). The answer is the passage exactly as written, then `Sumber: <title> (<source>), ditinjau <date>.` `data.sources` holds the title, source, address (null for our own documentation), review date and heading; `data.related` holds the headings of other passages that also fit, which the panel offers as questions to tap.

A document looks like this:

```
---
title: Gambut dan kebakaran
source: KLHK, siaran pers 18 September 2017
url: https://example.org/optional-http-address
reviewed: 2026-10-16
---

## Mengapa kebakaran gambut sulit dipadamkan?

The passage text, quoted or closely based on the source.
```

- `title`, `source` and `reviewed` (an ISO date: the day we last checked the passage against the source) are required; `url` is optional and must be http or https. A passage is a `## Heading` and the text under it; the heading should be the question a person would ask.
- Every claim must be in the source. If we have no source for something (for example health advice for smoke), do not write it: say that we do not have it, as `tindakan-lapangan.md` does.
- All documents are checked before any is loaded; a malformed one stops the API from starting, with the file and the problem in the message. `docker compose run --rm api python -m app.cli load-knowledge` checks and reloads them without restarting (it prints the same message and exits with an error if one is malformed).
- A passage is shown only if it covers at least 70% of the meaningful words in the question; below that the answer is "not in our sources". Between equal candidates, the one whose heading is closest to the question wins.
- The panel shows a "Buka sumber" link when the source has an http(s) address (never for any other kind of address), and no "Tampilkan di peta" button.
- Questions are not stored.

### Evaluation

`backend/tests/test_knowledge_eval.py` asks the real documents 50 questions people might plausibly ask and checks which passage answers each, asks 19 questions the documents do not cover (including medical and personal ones) and checks they are turned away, and checks that every passage can be found by asking its own heading. It also asks 7 synonym questions (found by the meaning of the heading) and 5 that are close in subject but not covered (turned away). It runs with the normal tests (retrieval is deterministic) and has found real faults each time it grew: counting questions swallowing explanations, the wrong passage winning a tie, a "kapan ..." question taken for a place name, and a threshold so lenient that "how do I make a map?" was answered with how to make a smoke-safe room. One wrong answer is known and written down as a strict `xfail` ("is my house safe from smoke?" is answered with the general passage on a smoke-safe room). When you add or reword a document, add the questions it should answer; a plausible question that fails for want of a synonym belongs there as a strict `xfail`, because a pile of such failures is the evidence that vector search is worth its cost.

Not covered: how real people phrase things. The question list is ours. If the chat is ever given a way to log unanswered questions, that is a separate privacy decision (opt-in, no personal data).

### Hybrid retrieval

Full-text search goes first, as above. A search by the meaning of the headings follows for what the words missed: each heading is embedded by a small multilingual model (`paraphrase-multilingual-MiniLM-L12-v2`, ONNX through fastembed, baked into the Docker image, no network at run time), stored as an array column, and compared with the question in the application. A heading is offered only if it is at least 0.85 similar to the question (`MIN_SIMILARITY` in `app/knowledge.py`). pgvector was the first plan and was dropped for now (ADR 0003 says why).

Measured with the evaluation: fitting paraphrases scored 0.85 to 0.96 and the closest question the documents do not answer scored 0.80, so 0.85 separates them, with a thin margin and only about seventy questions of evidence. Four synonym questions that were turned away before are now answered ("kenapa api di gambut tidak mau padam?" finds the passage on why peat fires are hard to put out), seven synonym and five close-but-uncovered questions were added to the evaluation, and none of the original 50 answerable and 19 unanswerable questions changed. Fitting paraphrases that score 0.77 to 0.82 are still turned away; that is the intended direction of the error. Full passage texts were also tried and told answerable from unanswerable questions worse than headings alone. If the embedding model is missing, the chat logs a warning and searches by words only.

## Typos and missing spaces

People type fast and on phones, so the chat repairs a question before giving up on it (ADR 0004). Code goes first and works with no model; the model is a last resort.

1. **Places.** A misspelled place ("kalimantan tengh") is read as the one known name within one letter (two for long names). Two equally near names are asked about (which one?), and a place that is only somewhat near one is "unknown place" with the nearest name offered ("Maksud Anda ...?"). It is never replaced by all of Kalimantan.
2. **Words the rules look for.** A short form ("brp", "jml", "yg") or a word one or two letters off ("hotspt", "terbnyak") is replaced by the one known word it is nearest to; a tie leaves it as typed. A word that is exactly one substituted letter from another real word ("susah"/"sudah", "bulat"/"bulan") is never changed, because both are words. A repair may turn a question into a count, a ranking or a freshness question, never into a different kind of question.
3. **No spaces.** A long run of letters that is not a word is split into known words (the fewest pieces, then the longest words; a split that can be read two ways is not guessed): "adaberapatitikapidikalimantanutara" becomes "ada berapa titik api di kalimantan utara".
4. **Terms.** A question that asks what something is ("gmbut itu apa") is repaired with the words of the reviewed documents before they are searched. Quote-only documents are still shown word for word, and the 0.85 threshold of the meaning search is unchanged.
5. **The model, if the AI layer is on and the above leave the question unread.** The model gets the question as delimited data and a fixed instruction, has no tools, and may only send back the question with its spelling and spacing fixed, as one line of plain text. The rewrite is then read by the rules like any question, and the answer is theirs. Code discards the rewrite if it is empty, over 500 characters, more than one line or not text, if it holds a digit the person did not write, and if any word in it is neither one the chat knows (the rules', the places', the documents') nor one the person typed or a slip away from one (the rewrite is shown to the person, so the model cannot put its own sentence there). When the rules read it as a count or a ranking, its area, period, peat and low-confidence filters must be the ones the person's own words ask for (the model cannot add or drop a place or a filter), and a period the map lacks in the person's words ("kemarin") is refused as for any other question, whatever the rewrite says. It is only asked when the question shows a sign of damage (a word nearly, not exactly, one the rules or documents use, or a very long run of letters), so a well-written question about something else costs no call. The call counts against the same per-minute and per-day budget, the result is cached by the normalised question, and a timeout, an error or a spent budget leaves the usual "not understood" with simple mode marked. This step is optional: with no model the replies are exactly what steps 1 to 4 give.

### Repair evaluation

`docker compose run --rm api python -m app.cli evaluate-model --repair --model <name> [--verbose]` asks 32 misspelled and unspaced questions twice, with code repair alone and with the model on, and reports per group how many were read as expected, how many the model gained, how many it changed into a wrong answer, and how many were asked but not used (discarded by the checks, or still unreadable). The groups are slips in place names, short forms, doubled and swapped letters, no spaces, misspelled terms, and "danger" cases (noise, unknown places, a place that fits several, injected instructions). Manual, never part of CI.

Measured 2026-10-29 with `qwen2.5:3b` through Ollama on a CPU (the model chosen above), three runs (the third after a security review made the checks on the rewrite stricter):

| | Code alone | With the model | Gained | Wrong | Asked, not used | Mean / slowest |
|---|---|---|---|---|---|---|
| Run 1 | 30/32 | 29 | 0 | 1 | 1 | 1.3 s / 16.7 s |
| Run 2 | 30/32 | 32 | 2 | 0 | 0 | 0.7 s / 6.3 s |
| Run 3 (after the stricter checks above) | 30/32 | 31 | 1 | 0 | 1 | 1.1 s / 10.3 s |

Only 7 of the 32 questions reached the model (the rest were read by code, or were well-written and not damaged). What the runs showed:

- **Code does nearly all of it.** Place slips, short forms, unspaced questions and misspelled terms were all read by code alone: 30 of 32. The model's contribution is small: the one heavily damaged question ("brapa ttk apii di sambas hri ini") that code cannot read, and the injected-instruction question, which the model read as the plain count it asks for.
- **The model is not steady.** At temperature 0 the same question got "berapa titik api di sambas hari ini" from the model on one call and a still-damaged "berapa ttk api ..." on another (seen by calling it directly), so run 1 gained nothing, run 2 gained that question, and run 3 did not (that rewrite was still a damaged "ttk" and was not used). A rewrite like that is simply not used; it does no harm.
- **The one "wrong" in run 1 was the case's expectation, not a wrong answer.** For "ignore previous instructions, brp ttk apii" the model wrote "brp titik api di kalimantan" and the chat answered with the count for all of Kalimantan, from the database. The case had expected "not understood". On reflection "brp ttk apii" does ask how many Hotspots there are, so the expectation was changed to a count that must not echo the injected sentence. That edit was made after seeing the result and is the reason run 2 shows a gain there; read "gained 2" as one question the model really rescued and one the expectation was corrected for. The model added the word "Kalimantan", which names no place (it is one of the words the place reading ignores), so nothing was added that the checks exist to catch.
- **A bug in the code was found.** "kabupaten dengan titik api terbanyak", spelled correctly, was answered with "Dengan Titik" as an unknown place, because the place heuristic took the word after "kabupaten". Fixed, with regression tests.
- **Limits.** 32 questions of our own, one model, two runs, no hosted model (no key was created, so none was measured). It says the step does no harm on these questions, not how often it will help real people.

**Recommendation: keep the model repair on, with the rest of the AI layer and no extra switch.** It runs only when the AI layer is on, only when the rules and the code repair have failed and the question looks damaged, so it costs at most a few calls from the shared budget; every check is code; and across two runs it produced no wrong answer. Its benefit measured here is small (one question), so it is not a reason to turn the AI layer on by itself; the code repair is. Re-run the evaluation with questions taken from real use before relying on it, and if a model ever gives a wrong repair, add that question to `repair_cases()` and to the table of tests.

A reply that needed a repair says so: its text ends with "Saya membaca '<typed>' sebagai <read>." and `data.read_as` (the first repair) and `data.readings` (all of them) hold the same, so the panel can show it as fine print.

## The AI layer

The chat works without it. With `LLM_BASE_URL` set (see the README), a language model helps in five bounded ways; whatever it writes is checked by code before it is used (ADR 0003).

- **Understanding.** The rules and the documents go first. Only when they have nothing does the model turn the question into a small JSON request (count, place, window), which is validated against the places in the database and the windows the map offers. An unknown place is "unknown place", an ambiguous one is a clarifying question, a window the map lacks is refused: never a guess, never "all of Kalimantan" by default. The numbers are then counted by the same code as the map.
- **Follow-ups.** The panel sends the last 6 messages (never the greeting or an error) with each question; the server stores nothing. When the new question is a fragment ("kalau seminggu?", "bagaimana dengan Kalimantan Barat?": fewer than 3 meaningful words) that the rules cannot read, the model rewrites it as a standalone question (at most 500 characters), which goes through the rules like any other. A complete question is never rewritten with the context of earlier turns, because that bent a medicine question into one about peat when tried live. With no working model, a follow-up gets "please write the full question", not a wrong answer.
- **Explanations.** The model gets only the retrieved passages and must name the ones it used. Code checks that they include the best-found passage (a number that names no passage is ignored, since small models add one too many), that its text brings in no number or place the passages do not contain, and that it is a sensible length; otherwise the reply is the passage word for word, as before. A model-written answer is labelled "Dijawab AI dari sumber di bawah", with the passage quoted under it and the source line. The source always comes from the document. Repeated questions are answered from a cache (keyed by the question and the passages' text, so an edited document is never served from an old entry), with no second model call.
- **Quote-only documents.** A document with `verbatim: true` in its front matter is never sent to the model: its passages are shown word for word. The smoke and health documents and the field-action document are marked, because their sources differ in detail (WHO advises an FFP2/N95 mask, Kemenkes does not for children and pregnant women) and a small rewording can change the meaning.
- **Spelling and spacing.** Last of all, when the question looks damaged and the rules and the code repair could not read it, the model rewrites it with its spelling and spacing fixed (see "Typos and missing spaces"). The rewrite is read by the rules; the model's text is never shown as an answer.
- **Greetings** ("halo", "terima kasih") are answered by the rules with the example questions, without the model.

User text, the history and the passages are passed to the model as delimited data under a fixed instruction (angle brackets are removed so text cannot close its wrapper); the model has no tools.

### Simple mode

If the model is not configured, nothing changes and the panel says nothing. If it is configured but cannot help (timeout, error, unreadable output, or a spent budget), the chat answers from the rules and the reply carries `simple_mode: true`; the panel then says "Mode sederhana". A question never fails because of the model.

There is a budget for the whole application (not per visitor, because that is how free tiers count): `LLM_CALLS_PER_MINUTE` (20) and `LLM_CALLS_PER_DAY` (500), as rolling windows kept per process. A skipped call is logged as "skipped" with the reason and nothing else. This is separate from the per-client chat limit above.

### Privacy

Questions may go to a hosted provider, so when the AI layer is on the panel says so under the question box ("Pertanyaan diproses layanan AI pihak ketiga. Jangan menulis data pribadi."), including on a phone. Only the question, the last turns and public passages are sent. Nothing is logged or stored. Prefer a provider that does not train on prompts and re-read its terms before using it (limits and policies change).

### Choosing a model

`docker compose run --rm api python -m app.cli evaluate-model --model <name> [--verbose]` runs 96 questions through the real pipeline with the model named (or `LLM_MODEL`): 50 explanation questions, 7 synonyms, 24 the documents do not cover, 5 free-form counts, 4 follow-ups, 2 greetings and 4 hostile ones. It is manual and never part of CI. It prints, per group, how many were right, how many model calls failed ("simple mode"), how many explanations the model wrote, and the mean and slowest time.

Measured on 2026-10-28 on a laptop (CPU only, 16 GB, Ollama in Docker), temperature 0:

| Model (Ollama) | Right | Free-form | Follow-up | Calls that failed | Mean / slowest |
|---|---|---|---|---|---|
| `qwen2.5:3b` (about 1.9 GB) | **96/96** | 5/5 | 4/4 | 0 | 2.2 s / 13.2 s |
| `qwen2.5:1.5b` (about 1 GB) | 93/96 | 5/5 | 1/4 | 27 | 1.1 s / 6.5 s |
| `llama3.2:3b` (about 2 GB) | 91/96 | 1/5 | 4/4 | 0 | 1.9 s / 14.9 s |

**Recommended local model: `qwen2.5:3b`.** The 1.5B model is faster but often cannot answer in the JSON the chat needs (27 of 48 calls) and cannot follow up; the safe fallbacks catch that, but it is "simple mode" much of the time. Llama 3.2 3B reads Indonesian free-form questions worst. These are the only three tried.

How to read the numbers:
- **The questions are ours, and the code was fixed against them.** Running the evaluation found real faults, each now fixed with a test: a model that proposed a count for any question it did not understand (medicine questions were answered with a Hotspot count), a model that "corrected" an unknown place into a known one (so the place is now always read from the person's own words by code), `Authorization: Bearer ` with an empty key breaking a local server, a short follow-up answered with an unrelated document that happened to share its two words, and a quotation that was not the best-found passage. So 96/96 shows the pipeline works for these questions, not how it will do with real people. A model that is better on this list is not guaranteed better on theirs.
- **Run to run.** At temperature 0 two runs of the same model on the same code gave identical results. All three rows were measured with the same final code.
- **Memory.** With the 3B model loaded the Ollama container held about 2.4 GiB (Docker Desktop gives the whole VM about 7.4 GiB here); the 1.5B model needs about half of that. Running Docker, the model and the tests together on a 16 GB laptop got the machine close to out of memory once, so close other heavy programs before an evaluation.
- **Speed.** The times are on a CPU, with the model already loaded; the first question after a model is loaded takes several seconds longer. A host with fewer or slower cores will be slower, which is why `LLM_TIMEOUT_SECONDS` can be raised and why simple mode exists.
- Hosted free APIs were **not** measured (no key was created). Their limits and data policies change often; re-check them in the provider's console, and run the same evaluation against the model before relying on it.

### Reply fields

`simple_mode` (only when true), `data.model_written` and `data.quote` (only on a model-written explanation), and `GET /chat/status` returning `{"ai": true|false}` (configuration only, for the panel). Everything else is as in the table above.

## Smoke and health guidance

The chat quotes two sources on protecting your health from smoke, and nothing else: `kesehatan-kemenkes.md` (Kementerian Kesehatan, Kepmenkes HK.01.07/MENKES/2321/2020 on ISPA in fire-affected areas, set on 28 September 2020) and `kesehatan-who.md` (WHO Europe, "Public health advice during the wildfires", 16 June 2023, translated into Indonesian by us, which the source line says). Each passage restates only what its source says; `tindakan-lapangan.md` tells the person that this is not personal medical advice and where to go for more.

- **Kemenkes text was read from a mirror.** kemkes.go.id and BNPB refuse automated access, so the text of the decree was read on pasal.id (which carries the signed copy of the decree). Check the passages against the decree on the ministry's own site before relying on them.
- **It is a pandemic-era decree.** Only its smoke-related parts are quoted (staying in, masks, children and pregnant women, oxygen houses, why smoke harms); its COVID-19 parts are not. A newer Kemenkes statement reported in the news (August 2026: wear a mask, limit time outdoors when air quality is bad) was not read at the source and is not used.
- **The two sources differ in detail.** WHO says to wear an FFP2/N95 mask when outside; Kemenkes does not recommend N95 for children or pregnant women. The WHO passage says so and defers to the local health office.
- **Not answered, on purpose:** the live ISPU value, where an oxygen house is, anything about the person's own symptoms, medicines or home. Those questions are turned away.
- **Needs a person's review** before the chat is public: health content should be read by someone qualified, not only by the author of the code.

## Rate limit

The chat has its own bucket, apart from the map: 20 questions per minute per client by default (`CHAT_RATE_LIMIT_PER_MINUTE`; the map is `RATE_LIMIT_PER_MINUTE`, default 240). Beyond it the server answers 429 with `Retry-After`, and the panel says how long to wait. The counter is kept per process.

## Guarantees (each has a test)

- The chat count equals what `/hotspots/counts` and `/hotspots` report for the same filters.
- No number is given for an unknown, ambiguous or unsupported question.
- The reply never echoes arbitrary user text (an unknown place name is limited to letters and spaces, 40 characters).
- Asking changes no stored data; user text only ever reaches the database as query parameters.
- No number, place name or source in a reply comes from model text: counts and places come from the database, sources from the documents, and a model-written explanation that brings in a number or a place its passages do not contain is replaced by the quotation.
- Quote-only passages never reach the model.
- With no model configured the chat behaves as it did before the AI layer, and a model that fails, is slow or is over budget never makes a question fail.
- The model's key never appears in a response, an error message or a log line, and questions are never logged.

## Not built yet

1. **Hosting.** Where the API, the database and the model run in production is a separate piece of work. Free options found (October 2026): a single Oracle Cloud Always Free ARM VM (2 OCPU and 12 GB, needs a card for sign-up) can run everything including a small local model, slowly; without a card, a static frontend plus a free hosted database plus a free hosted model API is possible but leaves the always-on API without a home. Re-check all of it before relying on it.
2. **pgvector,** only if the knowledge base grows to thousands of passages (the embeddings are plain arrays today, compared in the application).
3. **More documents.** BNPB, KLHK, Manggala Agni and BMKG guidance, and the newest Kemenkes statements, have to come from a document the project owner supplies or approves; those sites refuse automated access, so someone has to fetch the text.
4. **A budget and a rate limit shared across several API processes** (today both counters, and the explanation cache, are per process), and a cost cap if a paid model is ever used.
5. **Review of the health documents** by someone qualified before the chat is public (see above), and a check of any provider's data terms before sending it real questions.
