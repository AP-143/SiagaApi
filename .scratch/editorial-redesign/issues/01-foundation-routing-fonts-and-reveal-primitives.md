# 01: Foundation: routing, fonts, tokens and reveal primitives

**What to build:** A visitor can open `/` and see a placeholder Landing, open `/peta` and see the existing map, and an old shared link still opens the map. The shared building blocks the other tickets need exist: the new fonts, the Landing's paper-and-ink tokens, the grain layer, and a split-letters component that respects reduced motion. See `spec.md`.

**Blocked by:** none

**Status:** ready-for-agent

- [ ] A `Root` component chooses the view: `/peta` shows the map; `/` with a non-empty query shows the map; `/` with no query, and any other path, shows the Landing. `main.tsx` renders `Root`, and `App` stays the map component
- [ ] The map is loaded with `React.lazy`, and a test shows that rendering the Landing does not load MapLibre
- [ ] `index.html` loads Bodoni Moda (variable, weight 500, optical size axis) and Inter in place of Barlow; `font-variation-settings` pins the display optical size to 11
- [ ] The Landing's tokens (paper, darker paper, ink, ink at 72%, rust, hairline) are defined in a scope that does not depend on `data-theme`, so a stored dark theme does not change the Landing; the fixed multiply grain layer (38%) is available to it
- [ ] The Landing scrolls normally and the map still fills the viewport: the global `html, body, #root { height: 100% }` rule and the body background no longer leak across the two views
- [ ] A split-letters component renders a word as letters inside a wrapper with an `aria-label` of the full text and `aria-hidden` letters, and accepts a stagger per letter
- [ ] A shared reduced-motion hook (or use of `useReducedMotion`) makes the split-letters component, and later the other reveals, render the final state with no animation
- [ ] "Landing" is added to `GLOSSARY.md` in English
- [ ] Seam 1 tests cover: `/` shows the Landing, `/peta` shows the map, `/?province=ID62` shows the map, an unknown path shows the Landing, and the Landing view ignores a stored dark theme
- [ ] Seam 2 tests cover the split-letters component: it reads as one name to assistive technology, and with reduced motion on it renders at once
- [ ] The existing frontend tests still pass
