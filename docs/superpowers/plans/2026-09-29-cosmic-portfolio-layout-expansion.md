# Cosmic Portfolio Layout Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose the Silent Cosmos portfolio around a centered identity masthead, a reference-inspired Profile layout, a responsive seven-card Works grid, and a dedicated COSMO EFFECTS detail page.

**Architecture:** Keep the site build-free and static. Semantic HTML owns all navigation, work metadata, detail content, and future placeholders; shared CSS owns the 3/2/1-column responsive system; the existing Canvas modules remain optional visual enhancement and are reused unchanged on the nested detail page.

**Tech Stack:** HTML5, CSS3, Canvas 2D, browser ES modules, Node.js built-in test runner

**Spec:** `docs/superpowers/specs/2026-09-29-cosmic-portfolio-layout-expansion-design.md`

## Global Constraints

- Preserve the near-black `#050509`, violet, electric blue, ice blue, and restrained glow of the existing Silent Cosmos design.
- Use the reference site for layout ideas only; do not copy its logo, images, typefaces, text, exact spacing, or decorations.
- Keep exactly three public navigation destinations: `PROFILE`, `WORKS`, and `CONTACT`.
- Keep `about.html` as a compatibility redirect to `index.html` and out of the public navigation.
- Keep exactly one verified work, `COSMO EFFECTS`, plus six non-interactive `COMING SOON` cards numbered `W.002` through `W.007`.
- Do not add unverified client, employer, award, release, commission, or production-year claims; identify the work as `Unity VFX Study / Personal Study`.
- Add no raster images, reference-image derivatives, external libraries, CDNs, remote fonts, build step, CMS, or JSON rendering layer.
- Content and navigation must remain usable when JavaScript or Canvas is unavailable.
- Keep all URLs relative so the site works under a GitHub Pages repository subpath.
- Maintain `prefers-reduced-motion`, live preference changes, Canvas density caps, visibility pausing, and live-resize behavior already covered by the Canvas unit tests.

## Review Focus

- A nested detail page served under a GitHub Pages repository subpath must resolve every stylesheet, script, navigation link, and back link without root-absolute URLs; Task 2 adds per-page relative-reference tests.
- A person browsing without JavaScript or Canvas must still see the work title, metadata, detail copy, and all six Coming Soon states; Tasks 2 and 3 add static-HTML and fallback assertions.
- Keyboard users must be able to distinguish the real work link from unavailable Coming Soon cards; Tasks 2 and 3 add focus-style and no-false-link contracts.
- Long future titles or technology labels must not force a grid column wider than the viewport; Task 3 adds `min-width` and wrapping style contracts.
- Resizing through 3/2/1-column breakpoints must not crop either Canvas or introduce horizontal scrolling; Task 4 repeats live browser resizing after the structural changes.

---

### Task 1: Center the shared masthead and Profile identity

**Files:**
- Modify: `tests/site-structure.test.mjs:1-175`
- Modify: `tests/style-contract.test.mjs:1-58`
- Modify: `index.html:15-65`
- Modify: `works.html:15-26`
- Modify: `contact.html:15-26`
- Modify: `assets/css/style.css:121-216,277-470,814-985`

**Interfaces:**
- Consumes: existing `.site-header`, `.brand`, `.brand-mark`, `.brand-name`, `.site-nav`, `.hero`, and `.hero-copy` hooks.
- Produces: a shared two-row `.site-header`; a `.profile-emblem` containing `.profile-emblem-mark`; unchanged three-link `.site-nav` semantics consumed by the detail page in Task 2.

- [ ] **Step 1: Add failing structure tests for the shared brand and Profile emblem**

Add `site structure centers the same identity before navigation` and `profile uses a generated identity emblem instead of an image` to `tests/site-structure.test.mjs`. Assert that each main page header contains `.brand-mark` with `LF`, `.brand-name` with `LEFLEF`, and then `.site-nav`; assert that Profile has exactly one `.profile-emblem`, contains `.profile-emblem-mark` with `LF`, and contains no `<img>`.

- [ ] **Step 2: Add failing style contracts for the new layout hooks**

Extend `tests/style-contract.test.mjs` with assertions equivalent to:

```js
assert.match(css, /\.site-header[^\{]*\{[^}]*flex-direction:\s*column/s);
assert.match(css, /\.profile-emblem[^\{]*\{[^}]*aspect-ratio:\s*1/s);
assert.match(css, /\.profile-emblem-mark[^\{]*\{[^}]*place-items:\s*center/s);
```

- [ ] **Step 3: Run the focused tests and confirm the new contracts fail**

Run: `node --test tests/site-structure.test.mjs tests/style-contract.test.mjs`

Expected: FAIL because `.profile-emblem` is absent and `.site-header` is still a one-row fixed header.

- [ ] **Step 4: Implement the shared two-row masthead in the three main pages**

Keep the current brand text and navigation labels, but make the brand the first centered row and the nav the second centered row. Preserve each page's single `aria-current="page"`, skip link, and semantic `<nav aria-label="メインナビゲーション">`.

- [ ] **Step 5: Replace the Profile orbit block with the generated identity emblem**

In `index.html`, replace `.hero-orbit` with `.profile-emblem` containing `.profile-emblem-mark` (`LF`) and purely decorative orbit/star spans. Keep the existing Profile copy, Works link, and interest list unchanged.

- [ ] **Step 6: Restyle the masthead and Profile identity**

In `assets/css/style.css`, put `.site-header` in normal document flow with column alignment, centered brand, a separated nav row, and no content overlap. Style `.profile-emblem` as a large CSS-only circular violet/blue orbital mark. At widths below `1100px`, make Profile one column and center the emblem below the copy; below `720px`, shrink but do not hide the wordmark or any nav label.

- [ ] **Step 7: Run the focused and full suites**

Run: `node --test tests/site-structure.test.mjs tests/style-contract.test.mjs && npm test`

Expected: all tests PASS.

- [ ] **Step 8: Commit Task 1**

```bash
git add tests/site-structure.test.mjs tests/style-contract.test.mjs index.html works.html contact.html assets/css/style.css
git commit -m "feat: center portfolio masthead and profile identity"
```

### Task 2: Add the COSMO EFFECTS detail flow

**Files:**
- Create: `works/cosmo-effects/index.html`
- Modify: `works.html:35-68`
- Modify: `assets/css/style.css:571-712`
- Modify: `tests/site-structure.test.mjs:1-175`
- Modify: `tests/style-contract.test.mjs:1-58`

**Interfaces:**
- Consumes: Task 1's centered `.site-header` and three-link `.site-nav`; existing `canvas[data-work-preview]`, `assets/js/cosmic-field.js`, and `assets/js/work-preview.js` boot behavior.
- Produces: `works/cosmo-effects/index.html`; `.work-card-link`; `.work-detail-page`, `.work-detail-visual`, `.work-detail-grid`, and `.work-detail-actions` hooks consumed by responsive verification in Task 4.

- [ ] **Step 1: Add a failing detail-page existence and content test**

Add `Cosmo Effects has a truthful static detail page` to `tests/site-structure.test.mjs`. Assert that `works/cosmo-effects/index.html` exists, then read it and check:

```js
assert.match(detail, /<body\b[^>]*data-page="work-detail"/i);
assert.match(detail, /<title>COSMO EFFECTS — れふれふ<\/title>/i);
assert.match(detail, /Unity VFX Study/i);
assert.match(detail, /PERSONAL STUDY/i);
assert.match(detail, /<canvas\b[^>]*data-work-preview[^>]*aria-hidden="true"/i);
assert.match(detail, /class="[^"]*work-preview-fallback[^"]*"/i);
assert.doesNotMatch(detail, /client|employer|award|release|<img\b/i);
```

- [ ] **Step 2: Add failing navigation, script-order, and relative-path tests**

Assert that the W.001 card is one `<a class="...work-card-link..." href="works/cosmo-effects/index.html">`; the detail page links to `../../index.html`, `../../works.html`, and `../../contact.html`; its background module precedes its preview module; and it contains no `href="/` or `src="/`. Extend the local-reference checker to resolve each reference relative to the HTML file that contains it and include all tracked `.html` files, including nested pages.

- [ ] **Step 3: Add failing detail-page style and focus contracts**

Add `.work-card-link`, `.work-detail-page`, `.work-detail-visual`, `.work-detail-grid`, and `.work-detail-actions` to the required CSS hooks. Assert that `.work-card-link:focus-visible` receives a visible outline or border and that the preview remains sized by CSS.

- [ ] **Step 4: Run the focused tests and confirm they fail**

Run: `node --test tests/site-structure.test.mjs tests/style-contract.test.mjs`

Expected: FAIL because the nested detail page and interactive card do not exist.

- [ ] **Step 5: Make the COSMO EFFECTS card a complete link**

Change the existing W.001 card wrapper in `works.html` to `.work-card.work-card-link`, link it to `works/cosmo-effects/index.html`, restore a decorative outbound arrow only inside this real link, and keep its Canvas fallback, title, description, and tags in static HTML. Replace the numeric year with `Personal Study`.

- [ ] **Step 6: Create the static nested detail page**

Create `works/cosmo-effects/index.html` with the shared masthead using `../../` navigation, `WORKS` as `aria-current="page"`, a back link, title and study metadata, a large generated preview, overview, expression themes, technology tags, and links back to Works and Contact. Load `../../assets/js/cosmic-field.js` before `../../assets/js/work-preview.js`.

- [ ] **Step 7: Style the linked card and detail page**

Add the Task 2 hooks to `assets/css/style.css`. Make the whole W.001 card clickable with hover and keyboard focus that do not depend on motion. Give the detail visual a bounded aspect ratio and keep all readable content visible behind the Canvas fallback.

- [ ] **Step 8: Run the focused and full suites**

Run: `node --test tests/site-structure.test.mjs tests/style-contract.test.mjs && npm test`

Expected: all tests PASS, including existing Canvas live-resize and live reduced-motion tests.

- [ ] **Step 9: Commit Task 2**

```bash
git add works/cosmo-effects/index.html works.html assets/css/style.css tests/site-structure.test.mjs tests/style-contract.test.mjs
git commit -m "feat: add Cosmo Effects detail page"
```

### Task 3: Expand Works into a responsive seven-card grid

**Files:**
- Modify: `works.html:27-72`
- Modify: `assets/css/style.css:571-712,814-985`
- Modify: `tests/site-structure.test.mjs:1-210`
- Modify: `tests/style-contract.test.mjs:1-80`

**Interfaces:**
- Consumes: Task 2's `.work-card-link` W.001 card and nested detail URL.
- Produces: exactly six `.work-card.coming-soon-card[data-work-status="coming-soon"]` entries numbered W.002–W.007 and a `.works-grid` that resolves to 3, 2, and 1 columns at the specified breakpoints.

- [ ] **Step 1: Add a failing seven-card structure test**

Add `Works exposes one real project and six inert future slots`. Parse `works.html` and assert:

```js
const cards = [...works.matchAll(/<(?:a|article)\b[^>]*class="[^"]*\bwork-card\b[^"]*"/gi)];
assert.equal(cards.length, 7);
assert.equal((works.match(/data-work-status="coming-soon"/g) ?? []).length, 6);
for (let index = 2; index <= 7; index += 1) {
  assert.match(works, new RegExp(`W\\.00${index}[\\s\\S]*COMING SOON`, 'i'));
}
```

Also isolate each `.coming-soon-card` article and assert that it contains no `<a>`, `href`, `work-arrow`, or `data-work-preview`.

- [ ] **Step 2: Add failing 3/2/1-column and future-content resilience contracts**

Extend `tests/style-contract.test.mjs` to assert that the base `.works-grid` uses `repeat(3, minmax(0, 1fr))`, the `max-width: 1099px` rule uses `repeat(2, minmax(0, 1fr))`, and the `max-width: 719px` rule uses `1fr`. Require `.work-card` to have `min-width: 0` and work headings/tags to use an overflow-safe wrapping rule such as `overflow-wrap: anywhere`.

- [ ] **Step 3: Run the focused tests and confirm they fail**

Run: `node --test tests/site-structure.test.mjs tests/style-contract.test.mjs`

Expected: FAIL because only W.001 exists and the current grid is not 3/2/1 columns.

- [ ] **Step 4: Add W.002–W.007 as semantic non-links**

Append six `<article class="work-card coming-soon-card" data-work-status="coming-soon">` elements. Each contains its unique number, a CSS-only `.coming-soon-visual`, and the visible label `COMING SOON`; none contains a link, arrow, Canvas, fake description, or technology claim.

- [ ] **Step 5: Implement the responsive card system**

Make `.works-grid` three equal columns by default, two at `1099px` and below, and one at `719px` and below. Align card heights, constrain all children with `min-width: 0`, and add safe text wrapping. Give Coming Soon cards restrained CSS-only orbit/grid/star decoration and no hover translation or pointer cursor.

- [ ] **Step 6: Run the focused and full suites**

Run: `node --test tests/site-structure.test.mjs tests/style-contract.test.mjs && npm test`

Expected: all tests PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add works.html assets/css/style.css tests/site-structure.test.mjs tests/style-contract.test.mjs
git commit -m "feat: expand works into responsive showcase grid"
```

### Task 4: Document future additions and verify the complete flow

**Files:**
- Modify: `README.md:1-43`
- Modify: `tests/site-structure.test.mjs:175-230`

**Interfaces:**
- Consumes: Task 3's seven-card grid and `works/<slug>/index.html` convention.
- Produces: a documented four-step work-addition workflow and whole-site verification evidence.

- [ ] **Step 1: Add a failing README workflow contract**

Extend `repository policy documents preview, verification, motion, and image rules` to require `works/<slug>/index.html`, `COMING SOON`, and instructions to replace one placeholder card and copy the existing detail page.

- [ ] **Step 2: Run the README test and confirm it fails**

Run: `node --test tests/site-structure.test.mjs`

Expected: FAIL because the future-work workflow is not documented.

- [ ] **Step 3: Document the exact future-work addition flow**

Add a `## Adding a work` section to `README.md`: replace one Coming Soon article with a linked work card, copy `works/cosmo-effects/index.html` to `works/<slug>/index.html`, update only verified metadata, then run `npm test` and a local preview.

- [ ] **Step 4: Run automated integrity checks**

Run: `npm test`

Expected: all tests PASS.

Run: `git diff --check`

Expected: no output.

Run: `git ls-files | rg -i "Cosmo_effects|\.(png|jpe?g|webp|gif)$"`

Expected: no output.

- [ ] **Step 5: Verify the rendered pages and responsive transitions**

Start a local static server from the repository. Visit `index.html`, `works.html`, `contact.html`, `about.html`, and `works/cosmo-effects/index.html` at approximately `1440×1000`, `900×1000`, and `390×844`. Confirm 3/2/1 Works columns, centered masthead identity, Profile stacking, W.001 detail navigation, six inert Coming Soon cards, visible focus, no horizontal overflow, and no console errors.

- [ ] **Step 6: Verify Canvas behavior after the new layout**

Without reloading, resize the Profile and detail pages from desktop to mobile width and confirm each Canvas follows its container. Confirm the detail content remains visible when JavaScript is disabled or Canvas is unavailable. Confirm reduced-motion CSS and the existing live media-query unit tests remain green.

- [ ] **Step 7: Commit Task 4**

```bash
git add README.md tests/site-structure.test.mjs
git commit -m "docs: explain future portfolio work additions"
```

## Final verification

Run: `npm test && git diff --check && git status --short`

Expected: all tests PASS, no whitespace errors, and a clean working tree.
