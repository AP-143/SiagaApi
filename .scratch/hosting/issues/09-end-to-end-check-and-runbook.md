# End to end check and a short runbook

Status: claimed
Blocked by: 08

Spec: `../spec.md` (Acceptance)

## What to build

Run the acceptance list in the spec against the public address (the Claude in Chrome tools may be used for the browser part, with the owner's tab permissions), then write `docs/hosting.md`: the architecture in one picture, where every setting lives, how to deploy a change, how to read logs, how to repeat the seed, what to do when the schedule pauses or Neon or Render hits a limit, and the known compromises. Link it from `README.md`, and update `docs/chatbot.md` ("Not built yet" no longer lists hosting as open).

## Acceptance criteria

- [ ] Every line of the spec's Acceptance section is checked, with the evidence (a command output or a screenshot path) in the comments, and anything that fails is reported plainly.
- [ ] `docs/hosting.md` lets someone rebuild everything from an empty Neon project and an empty Render account.
- [ ] No secret appears in the repository or in the docs.

## Comments

2026-10-30, checked on the public address:
- [x] Page over HTTPS, map with Hotspots and Peatlands, 7 API calls all 200, no console errors (Claude in Chrome); chat answered a numbers question ("1.254 titik api di Kalimantan Tengah, 751 di lahan gambut"), an explanation question that only the embedding search matches, and a health question got the "not in our sources" reply.
- [x] First request after a quiet spell: 2.4 s after 20 minutes idle, so the waking message (after 8 s) did not even show.
- [x] The notice shows on the Landing and in the map's credits panel, checked at 390 px width (no horizontal scroll, text wraps). The Landing is light only and the map dark only, so there is no second theme to check.
- [x] The built frontend bundle holds no connection string or FIRMS key, and no Neon address with a password is in the repository.
- [x] WAF rule: 230 quick requests from one address gave 200 allowed and 30 answered 429.
- [ ] The scheduled workflow has run twice by itself: GitHub had not started the first scheduled run 1.5 hours after the merge. Left open until two scheduled runs are seen.
- [x] `docs/hosting.md` updated (deploy from Git, previews off, roll back, logs, cold start), linked from the README.
