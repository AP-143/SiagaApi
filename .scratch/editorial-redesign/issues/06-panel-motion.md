# 06: Panel motion on the map

**What to build:** Panels on the map open and close with a short, quiet motion, and the theme change and loading states feel smooth, without slowing a Responder down. See `spec.md`.

**Blocked by:** 05: Restyle the map in light and dark

**Status:** ready-for-agent

- [ ] Opening and closing a collapsible panel (filter, layers, chat, summary) animates its height and opacity with `motion`, in 250ms or less, and the content is usable the moment the panel is open
- [ ] New chat messages and the typing indicator appear with a short fade and rise
- [ ] Changing the theme transitions colours without flashing
- [ ] Only transform and opacity are animated, plus height for the collapsible; nothing animates layout properties on every frame
- [ ] With reduced motion, panels open and close at once
- [ ] No animation delays a control from being usable, and keyboard focus is not lost when a panel opens or closes
- [ ] The existing panel and chat tests pass, and a new test covers the reduced-motion path
