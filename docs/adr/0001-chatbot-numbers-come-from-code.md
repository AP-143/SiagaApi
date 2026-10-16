# In the chatbot, numbers and places come from code, never from a language model

Status: accepted

The chatbot answers questions about Hotspots for people who may act on the answer, so a wrong count or a wrongly guessed place is worse than no answer. We therefore split the work: a question is turned into a structured request (intent, place, time window, filters), the numbers are read from the database with the same query code the map uses, and the answer is written from a fixed template. A language model, when one is added, may only help with the first step, choosing among the same structured intents. It never writes a number, a place name, or a source.

The first version has no language model at all: plain rules understand the question, so it costs nothing, runs offline, and cannot invent anything. When a model is added later it only widens which phrasings are understood, and the rule-based path stays as the fallback for when a free or paid model service is slow, rate-limited or down, which is likely exactly when traffic peaks.

## Considered options

- **A model that writes free-form answers from retrieved data or documents ("plain RAG").** Rejected for counts and locations: a retrieved row can still be misquoted, rounded or mixed up, and free or small models do it more often. RAG remains the plan for explanatory questions (what a Hotspot or Confidence is), where the answer is a quotation of a reviewed document with its source shown.
- **A model that calls our API through tool calling and then writes the reply.** Rejected for the same reason: the numbers would pass through the model's text.

## Consequences

- Questions are understood only as well as the rules (and later the model's intent choice) allow. An unrecognized place or period gets a clarifying or refusing answer, not a guess; "Banjar Baru" versus "Banjar", or "Kutai" with three candidates, are handled explicitly.
- The chat and the map share one query module, so they cannot disagree; a test compares them.
- `POST /chat` is the one non-GET route. It only reads, and a test checks that asking changes no stored data.
