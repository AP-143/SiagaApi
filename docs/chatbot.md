# Chatbot

Status: **data questions, the chat panel, a stricter chat rate limit, and explanations quoted from reviewed documents are done.** There is no language model and no embedding model. See `docs/adr/0001-chatbot-numbers-come-from-code.md` and `docs/adr/0002-chat-explains-by-quoting-reviewed-documents.md` for why it is built this way.

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

`backend/tests/test_knowledge_eval.py` asks the real documents 50 questions people might plausibly ask and checks which passage answers each, asks 19 questions the documents do not cover (including medical and personal ones) and checks they are turned away, and checks that every passage can be found by asking its own heading. It runs with the normal tests (retrieval is deterministic) and has found real faults each time it grew: counting questions swallowing explanations, the wrong passage winning a tie, a "kapan ..." question taken for a place name, and a threshold so lenient that "how do I make a map?" was answered with how to make a smoke-safe room. One wrong answer is known and written down as a strict `xfail` ("is my house safe from smoke?" is answered with the general passage on a smoke-safe room). When you add or reword a document, add the questions it should answer; a plausible question that fails for want of a synonym belongs there as a strict `xfail`, because a pile of such failures is the evidence that vector search is worth its cost.

Not covered: how real people phrase things. The question list is ours. If the chat is ever given a way to log unanswered questions, that is a separate privacy decision (opt-in, no personal data).

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

## Not built yet

1. **Vector search.** Only worth it if the evaluation shows real questions missing because of wording. It needs a database image with pgvector and an embedding model: a local open-source one (nothing is installed on this machine, by decision) or a free API that requires an account and a key. Indonesian retrieval quality would have to be measured on our own questions first. Answers would still quote the document and show the source.
2. **A language model for free-form phrasing.** Only to choose among the same structured intents; numbers and places stay in code (ADR 0001). A free or low-cost provider needs an account and API key the project owner creates; free tiers have rate limits and may use prompts to improve the provider's products, so no personal data should be sent.
3. **More documents.** BNPB, KLHK, Manggala Agni and BMKG guidance, and the newest Kemenkes statements, have to come from a document the project owner supplies or approves; those sites refuse automated access, so someone has to fetch the text.
4. **A cost cap** if a paid model is ever used, and a rate limit shared across several API processes (today the counter is per process).
