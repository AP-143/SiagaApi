# Delete the spike's leftovers

Status: ready-for-agent
Blocked by: 08

## What to do

Delete the Vercel project `siagaapi-spike`, the Neon branch `spike`, and the local files of the spike (the scratchpad folder with its connection-string files). Check afterwards that `neon branches list` shows only `main` and that `vercel ls` shows the real projects only.

## Acceptance criteria

- [ ] Nothing of the spike remains on Vercel, Neon or disk.

## Comments
