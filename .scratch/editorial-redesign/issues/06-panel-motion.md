# 06: Panel motion on the map

**What to build:** Panels on the map open and close with a short, quiet motion, and the theme change and loading states feel smooth, without slowing a Responder down. See `spec.md`.

**Blocked by:** 05: Restyle the map in light and dark

**Status:** ready-for-agent

- [x] Opening and closing a collapsible panel (filter, layers, chat, summary) animates its height and opacity with `motion`, in 250ms or less, and the content is usable the moment the panel is open
- [x] New chat messages and the typing indicator appear with a short fade and rise
- [x] Changing the theme transitions colours without flashing
- [x] Only transform and opacity are animated, plus height for the collapsible; nothing animates layout properties on every frame
- [x] With reduced motion, panels open and close at once
- [x] No animation delays a control from being usable, and keyboard focus is not lost when a panel opens or closes
- [x] The existing panel and chat tests pass, and a new test covers the reduced-motion path

## Comments

- Checked in a browser: a panel's height eases between 0 and its full height in about 220ms and is removed from the page once closed; after opening it scrolls as before (`overflow-y: auto`, no inline overflow left behind). The first version left an inline `overflow: hidden` that would have stopped a tall panel from scrolling; it is gone, and the old CSS `fade-in` animation that duplicated the new fade was removed.
- The theme cross-fade (`.theme-fade`, 250ms, skipped with reduced motion) is plain CSS and was not watched frame by frame.
- jsdom prints "Not implemented: window.scrollTo" while the chat panel tests run; it is noise from jsdom, not a failure.
