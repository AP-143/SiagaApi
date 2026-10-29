# End to end check and a short runbook

Status: ready-for-agent
Blocked by: 08

Spec: `../spec.md` (Acceptance)

## What to build

Run the acceptance list in the spec against the public address (the Claude in Chrome tools may be used for the browser part, with the owner's tab permissions), then write `docs/hosting.md`: the architecture in one picture, where every setting lives, how to deploy a change, how to read logs, how to repeat the seed, what to do when the schedule pauses or Neon or Render hits a limit, and the known compromises. Link it from `README.md`, and update `docs/chatbot.md` ("Not built yet" no longer lists hosting as open).

## Acceptance criteria

- [ ] Every line of the spec's Acceptance section is checked, with the evidence (a command output or a screenshot path) in the comments, and anything that fails is reported plainly.
- [ ] `docs/hosting.md` lets someone rebuild everything from an empty Neon project and an empty Render account.
- [ ] No secret appears in the repository or in the docs.

## Comments
