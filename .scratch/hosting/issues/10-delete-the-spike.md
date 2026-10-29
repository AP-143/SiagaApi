# Delete the spike's leftovers

Status: resolved
Blocked by: 08

## What to do

Delete the Vercel project `siagaapi-spike`, the Neon branch `spike`, and the local files of the spike (the scratchpad folder with its connection-string files). Check afterwards that `neon branches list` shows only `main` and that `vercel ls` shows the real projects only.

## Acceptance criteria

- [x] Nothing of the spike remains on Vercel, Neon or disk.

## Comments

Deleted on 2026-10-30: Vercel project `siagaapi-spike`, Neon branch `spike`, and the spike folder and connection-string files in the scratchpad. `vercel project ls` shows `siagaapi` and `siagaapi-api`; `neon branches list` shows only `main`.
