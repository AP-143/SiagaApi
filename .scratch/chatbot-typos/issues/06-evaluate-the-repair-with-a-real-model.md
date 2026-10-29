# 06: Evaluate the repair with a real model

**What to build:** The manual evaluation script (not part of CI) measures how well a real configured model repairs misspelled and unspaced Indonesian questions, how often it repairs wrongly, and how long it takes, and the result decides whether the model repair stays on by default. See `spec.md` and ADR 0004.

**Blocked by:** 05: The model repairs spelling and spacing when the rules still cannot read a question

**Status:** ready-for-agent

- [ ] A question set for repair is added to the evaluation: slips in place names, short forms, doubled and swapped letters, sentences with no spaces, badly misspelled terms, and cases where a wrong repair is the danger (a typo that lands on another valid place or word; noise that must stay noise)
- [ ] The script reports, per group, how many were read as expected after code repair alone, how many more after the model repair, how many the model repaired wrongly (a wrong place, intent or number) and how many were discarded by the checks, plus the time taken
- [ ] The run is made against the local model chosen in `docs/chatbot.md` and, if one is available, a hosted one; results and the date are written to `docs/chatbot.md`
- [ ] A short recommendation is written there: keep the model repair on, keep it behind an extra switch, or leave it out, with the numbers that support it
- [ ] Any wrong repair the evaluation finds becomes a regression case in the automatic table of tickets 01 to 05 (refused by code, or by the checks)
