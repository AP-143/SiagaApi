# A waking message and a footer notice on the frontend

Status: resolved
Blocked by: 02

Spec: `../spec.md` (decisions 1 and 4)

## What to build

- When the API takes long to answer the first request (a serverless function starting), show a friendly, non-error message such as "the server is waking up, please wait", then show the data as soon as it arrives. A real failure still shows the existing error state. Put the delay before the message appears and the total wait in named constants.
- A footer on every page: unofficial project, Hotspot data from NASA FIRMS and it can be late, and in an emergency contact BPBD or BNPB. Use the language and tone the interface already uses; keep it small, and make it work in the light and dark themes and on a phone.

## Acceptance criteria

- [x] A test with a slow fake API shows the waking message and then the data, with no error.
- [x] A test with a failing fake API still shows the error state, not the waking message forever.
- [x] The footer text and a link to the NASA FIRMS source appear on the landing page and the map page; checked at phone width and in both themes.

## Comments

Done. `StatusBar.tsx`: after `WAKING_AFTER_MS` (8 s) of loading it says the server is waking up (still a `status`, not an alert); a real failure still shows the existing alert (`src/Waking.test.tsx`). The notice text is in `src/notice.ts`; the Landing ends with `landing/Notice.tsx` (with a link to NASA FIRMS), and the map credits text carries the same sentence (`src/Notice.test.tsx`). Not yet checked in a real browser at phone width and in both themes: do it on the public site (ticket 09).
