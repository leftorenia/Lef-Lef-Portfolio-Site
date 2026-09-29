# Cosmic Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unfinished ocean-themed portfolio with a restrained three-page cosmic portfolio that presents Leflef as a Shader / VFX explorer.

**Architecture:** Keep the site dependency-free and deployable as static files on GitHub Pages. Semantic HTML owns all content and navigation, one CSS file owns the visual system and responsive behavior, and two small ES modules independently own the ambient page background and the generated Works preview.

**Tech Stack:** HTML5, CSS3, Canvas 2D, browser ES modules, Node.js built-in test runner

**Spec:** `docs/superpowers/specs/2026-09-29-cosmic-portfolio-design.md`

## Global Constraints

- Public navigation contains exactly `PROFILE`, `WORKS`, and `CONTACT`.
- Japanese is the body-copy language; short headings and labels may use English.
- The palette is near-black `#050509` with violet, electric blue, ice blue, and only minimal pink or yellow accents.
- `Cosmo_effects.png`, crops, traces, and derivative image files must never be added to the repository.
- Stars, constellation lines, meteors, nebulae, and the Works visual are generated with CSS and Canvas only.
- Do not add libraries, CDNs, remote fonts, a build step, CMS, form backend, analytics, or new work claims.
- Keep the site directly deployable through GitHub Pages.
- JavaScript failure must not hide navigation or page content.
- Honor `prefers-reduced-motion: reduce`, cap Canvas pixel density, and reduce effects on mobile.

## Review Focus

- A 390px-wide viewport must retain readable content, three usable navigation links, and no horizontal page overflow; Task 2 owns the CSS contract and Task 5 owns rendered verification.
- `prefers-reduced-motion: reduce` must prevent animation loops while retaining one static cosmic frame; Tasks 3 and 4 test this behavior.
- Device pixel ratios above `1.5` must be clamped to avoid oversized Canvas buffers; Tasks 3 and 4 test the cap.
- Missing or unsupported Canvas contexts must leave all HTML content usable and must not throw; Tasks 3 and 4 test null-context behavior.
- Missing Works preview elements must be a valid no-op rather than a startup error; Task 4 tests an empty root.

---

## File map

- `index.html` — Profile landing page and primary introduction.
- `works.html` — One truthful `COSMO EFFECTS` study entry plus an extensible work-card structure.
- `contact.html` — Email and verified social destinations.
- `about.html` — Backward-compatible redirect and visible fallback link to `index.html`.
- `assets/css/style.css` — Complete visual system, page layouts, responsive rules, focus styles, and reduced-motion rules.
- `assets/js/cosmic-field.js` — Shared ambient background Canvas and its pure scene-configuration helper.
- `assets/js/work-preview.js` — Self-contained generated preview for Works and its pure preview-configuration helper.
- `assets/js/ocean-bg.js` — Remove after all pages stop referencing it.
- `package.json` — Dependency-free test command only.
- `tests/site-structure.test.mjs` — HTML content, navigation, links, scripts, and image-policy contracts.
- `tests/style-contract.test.mjs` — Palette, accessibility, responsive, layering, and remote-asset contracts.
- `tests/cosmic-field.test.mjs` — Background configuration and failure-mode unit tests.
- `tests/work-preview.test.mjs` — Preview configuration, empty-root, and failure-mode unit tests.
- `README.md` — Updated purpose, page map, local preview, and verification commands.

### Task 1: Semantic three-page content

**Files:**
- Create: `package.json`
- Create: `tests/site-structure.test.mjs`
- Modify: `index.html:1-38`
- Modify: `works.html:1-40`
- Modify: `contact.html:1-39`
- Modify: `about.html:1-42`

**Interfaces:**
- Consumes: existing public social URLs and the approved copy/structure from the design spec.
- Produces: `body[data-page]`, `.site-header`, `.site-nav`, `.page-shell`, `.section-index`, `.eyebrow`, `.work-card`, and `canvas[data-work-preview]` hooks used by Tasks 2–4.

- [ ] **Step 1: Add the test runner and failing HTML contract tests**

Create `package.json` with `"type": "module"` and `"test": "node --test"`. In `tests/site-structure.test.mjs`, use only `node:test`, `node:assert/strict`, `node:fs`, and `node:path`. Assert:

```js
assert.deepEqual(navLabels(html), ['PROFILE', 'WORKS', 'CONTACT']);
assert.match(activePageHtml, /aria-current="page"/);
assert.doesNotMatch(allHtml, /YOUR NAME|作品を準備中|<img\b|Cosmo_effects\.png/i);
assert.match(indexHtml, /Shader \/ VFX Explorer/);
assert.match(worksHtml, /COSMO EFFECTS/);
assert.match(contactHtml, /mailto:leftorenia@gmail\.com/);
assert.match(aboutHtml, /url=index\.html/i);
```

Also assert that every `target="_blank"` anchor contains `rel="noopener noreferrer"`, the three main pages have one skip link and one `<main id="main-content">`, and only verified GitHub, X, note, and email destinations are present.

- [ ] **Step 2: Run the tests and confirm the old pages fail**

Run: `node --test --test-name-pattern="site structure" tests/site-structure.test.mjs`

Expected: FAIL because the old pages expose Home/About, placeholders, incorrect links, and no approved page structure.

- [ ] **Step 3: Replace the four page documents**

Implement:

- `index.html`: Profile hero with `LEFLEF`, `れふれふ`, `Shader / VFX Explorer`, a concise Japanese introduction, and four interest labels: `SHADER`, `REALTIME VFX`, `UNITY`, `VISUAL STUDY`.
- `works.html`: one `<article class="work-card">` titled `COSMO EFFECTS`, labeled `Unity VFX Study`, with an accessible text description and `<canvas class="work-preview" data-work-preview aria-hidden="true"></canvas>`; do not claim a client, employer, or release.
- `contact.html`: a short neutral invitation plus Email, GitHub, X, and note links; do not state that commissions are open.
- `about.html`: immediate meta refresh to `index.html`, canonical link to `index.html`, and a visible Japanese fallback link.

All three main pages get the same three-link header, page index (`01`, `02`, `03`), coordinate-style label (`FIELD 01`, `FIELD 02`, `FIELD 03`), `aria-current="page"` on the active link, skip link, footer, and no JavaScript dependency for content. Use the exact titles `PROFILE — れふれふ`, `WORKS — れふれふ`, and `CONTACT — れふれふ`.

- [ ] **Step 4: Run the HTML contract tests**

Run: `node --test --test-name-pattern="site structure" tests/site-structure.test.mjs`

Expected: PASS for page count, copy, navigation, links, fallback redirect, and image policy.

- [ ] **Step 5: Commit the semantic content**

```bash
git add package.json tests/site-structure.test.mjs index.html works.html contact.html about.html
git commit -m "feat: restructure portfolio into three pages"
```

### Task 2: Silent Cosmos visual system

**Files:**
- Create: `tests/style-contract.test.mjs`
- Modify: `assets/css/style.css:1-150`

**Interfaces:**
- Consumes: the class hooks produced by Task 1.
- Produces: CSS custom properties and responsive layouts used by both Canvas modules without requiring runtime layout changes.

- [ ] **Step 1: Write failing visual-system contract tests**

Read `assets/css/style.css` as text and assert the approved values and fallbacks:

```js
assert.match(css, /--color-bg:\s*#050509/i);
assert.match(css, /:focus-visible/);
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.match(css, /@media[^{}]*max-width:\s*720px/s);
assert.match(css, /#cosmic-field[^}]*pointer-events:\s*none/s);
assert.match(css, /\.work-preview[^}]*aspect-ratio:/s);
assert.doesNotMatch(css, /url\(["']?https?:\/\//i);
```

Also assert that `.site-nav`, `.hero`, `.profile-grid`, `.works-grid`, `.contact-links`, `.skip-link`, and `.static-nebula` all have rules.

- [ ] **Step 2: Run the style test and confirm it fails**

Run: `node --test --test-name-pattern="style contract" tests/style-contract.test.mjs`

Expected: FAIL because the current stylesheet lacks the approved tokens, layout hooks, responsive contract, and reduced-motion treatment.

- [ ] **Step 3: Rebuild `assets/css/style.css`**

Define the exact background token `#050509`, restrained violet/blue/ice accents, text and muted-text tokens, a sans-serif display stack, and a monospace metadata stack. Implement:

- fixed translucent header with a hairline border and three-link navigation;
- full-height Profile hero, two-column profile details, Works card, Contact link rows, and compact footer;
- CSS-only `.static-nebula` fallback using low-opacity radial gradients;
- visible `:focus-visible` outlines and non-color active-link marker;
- Work canvas clipping and subtle hover luminance without scale jumps;
- a short `.page-shell` entry fade/slide that is completely disabled by reduced-motion rules;
- `max-width: 720px` single-column layout and wrapped but always visible navigation;
- `prefers-reduced-motion: reduce` removal of transitions and decorative CSS animation;
- `overflow-x: clip` with `overflow-x: hidden` fallback.

- [ ] **Step 4: Run the style and existing HTML tests**

Run: `npm test`

Expected: all current tests PASS.

- [ ] **Step 5: Commit the visual system**

```bash
git add tests/style-contract.test.mjs assets/css/style.css
git commit -m "feat: add silent cosmos visual system"
```

### Task 3: Ambient cosmic background

**Files:**
- Create: `tests/cosmic-field.test.mjs`
- Create: `assets/js/cosmic-field.js`
- Modify: `index.html`
- Modify: `works.html`
- Modify: `contact.html`
- Delete: `assets/js/ocean-bg.js`

**Interfaces:**
- Consumes: page body and the `#cosmic-field` CSS hook from Task 2.
- Produces: `getSceneMetrics({ width, height, devicePixelRatio, reducedMotion }) -> { pixelRatio, starCount, constellationCount, animate, meteors }`; `createCosmicScene(canvas, { windowTarget, documentTarget, reducedMotion, random, requestFrame, cancelFrame }?) -> { renderStatic(), destroy() }`; and `bootCosmicField(doc?, win?) -> scene|null`.

- [ ] **Step 1: Write failing unit tests for scene policy and resilience**

Test the exported functions with no browser globals. Assert:

```js
assert.equal(getSceneMetrics({ width: 1440, height: 900, devicePixelRatio: 3, reducedMotion: false }).pixelRatio, 1.5);
assert.ok(mobile.starCount < desktop.starCount);
assert.deepEqual(reduced, { ...reduced, animate: false, meteors: 0 });
assert.doesNotThrow(() => createCosmicScene({ getContext: () => null }).destroy());
assert.equal(bootCosmicField({ getElementById: () => null, createElement: () => null }), null);
```

Also assert desktop stars never exceed `110`, mobile stars never exceed `72`, reduced-motion stars never exceed `42`, and a zero-sized viewport returns finite non-negative counts. With a no-op fake 2D context and an injected `requestFrame` spy, assert `createCosmicScene(..., { reducedMotion: true })` renders the static frame without requesting an animation frame.

- [ ] **Step 2: Run the cosmic-field tests and confirm the missing module fails**

Run: `node --test tests/cosmic-field.test.mjs`

Expected: FAIL with module-not-found for `assets/js/cosmic-field.js`.

- [ ] **Step 3: Implement `assets/js/cosmic-field.js`**

Implement the three exported interfaces. `bootCosmicField` creates one fixed `canvas#cosmic-field` with `aria-hidden="true"`; `createCosmicScene` renders low-density depth-layered stars, short-lived constellation lines, low-opacity edge nebulae, and infrequent meteors in violet/blue/ice tones. Clamp DPR to `1.5`, respond to resize and visibility changes, apply subtle pointer parallax, draw once when reduced motion is requested, and remove every listener plus animation frame in `destroy()`.

Guard all DOM and Canvas access so importing the module in Node, missing `document`, or `getContext('2d') === null` is safe.

- [ ] **Step 4: Integrate the ES module and remove the ocean implementation**

Add `<script type="module" src="assets/js/cosmic-field.js"></script>` to all three main pages. Remove every `ocean-bg.js` reference, then delete `assets/js/ocean-bg.js`.

- [ ] **Step 5: Run the full suite**

Run: `npm test`

Expected: all tests PASS, including reduced motion, high-DPR clamping, mobile density, null Canvas context, and HTML script references.

- [ ] **Step 6: Commit the generated background**

```bash
git add tests/cosmic-field.test.mjs assets/js/cosmic-field.js assets/js/ocean-bg.js index.html works.html contact.html
git commit -m "feat: add restrained cosmic canvas background"
```

### Task 4: Generated Works preview

**Files:**
- Create: `tests/work-preview.test.mjs`
- Create: `assets/js/work-preview.js`
- Modify: `works.html`

**Interfaces:**
- Consumes: `canvas[data-work-preview]` from Task 1 and `.work-preview` sizing from Task 2.
- Produces: `getPreviewMetrics({ width, height, devicePixelRatio, reducedMotion }) -> { pixelRatio, particleCount, animate }`; `createWorkPreview(canvas, { windowTarget, documentTarget, reducedMotion, random, requestFrame, cancelFrame }?) -> { renderStatic(), destroy() }`; and `bootWorkPreviews(root?, win?) -> number`.

- [ ] **Step 1: Write failing unit tests for preview policy and no-op behavior**

Assert DPR clamping, reduced-motion static behavior, and graceful absence:

```js
assert.equal(getPreviewMetrics({ width: 900, height: 520, devicePixelRatio: 4, reducedMotion: false }).pixelRatio, 1.5);
assert.equal(getPreviewMetrics({ width: 900, height: 520, devicePixelRatio: 1, reducedMotion: true }).animate, false);
assert.equal(bootWorkPreviews({ querySelectorAll: () => [] }), 0);
assert.doesNotThrow(() => createWorkPreview({ getContext: () => null }).destroy());
```

Also assert particle count remains at or below `64` and all zero-sized input results are finite. With a no-op fake 2D context and an injected `requestFrame` spy, assert `createWorkPreview(..., { reducedMotion: true })` renders once without requesting an animation frame.

- [ ] **Step 2: Run the preview tests and confirm the missing module fails**

Run: `node --test tests/work-preview.test.mjs`

Expected: FAIL with module-not-found for `assets/js/work-preview.js`.

- [ ] **Step 3: Implement the generated preview**

Create a single abstract composition that borrows only the approved motifs: one soft orbital focal point, a sparse constellation path, a violet-blue glow, and an occasional diagonal light streak. Do not load images and do not reproduce the Unity screenshot layout, grid, UI, or exact particle arrangement.

Implement the three exported interfaces, cap DPR at `1.5`, cap particles at `64`, stop when hidden, draw once for reduced motion, and fully clean up listeners and frames from `destroy()`.

- [ ] **Step 4: Load the module only on Works**

Add `<script type="module" src="assets/js/work-preview.js"></script>` to `works.html` after the shared cosmic-field module.

- [ ] **Step 5: Run the full suite**

Run: `npm test`

Expected: all tests PASS, including empty-root and null-context cases.

- [ ] **Step 6: Commit the Works preview**

```bash
git add tests/work-preview.test.mjs assets/js/work-preview.js works.html
git commit -m "feat: add generated cosmo work preview"
```

### Task 5: Documentation and rendered verification

**Files:**
- Modify: `README.md:1-5`
- Modify: `tests/site-structure.test.mjs`

**Interfaces:**
- Consumes: all completed pages, styles, and modules.
- Produces: final repository-level policy checks and contributor instructions.

- [ ] **Step 1: Add final failing repository-policy assertions**

Extend `tests/site-structure.test.mjs` to recursively inspect tracked site files. Assert there are no `.png`, `.jpg`, `.jpeg`, `.webp`, or `.gif` files; no `ocean-bg.js` references; exactly three public navigation destinations; every local `href`/`src` referenced by a main page resolves to an existing file; and `README.md` documents `npm test`, `python -m http.server 4173`, reduced motion, and the reference-image prohibition.

- [ ] **Step 2: Run the policy test and confirm README/integration gaps**

Run: `npm test`

Expected: FAIL until all stale references and asset-policy violations are resolved.

- [ ] **Step 3: Update `README.md`**

Document the three pages, dependency-free implementation, `npm test`, a local static-server command (`python -m http.server 4173`), reduced-motion behavior, and the rule that the supplied reference image is not part of the site.

- [ ] **Step 4: Run automated verification**

Run:

```bash
npm test
git diff --check
git status --short
```

Expected: tests report zero failures, `git diff --check` prints nothing, and status lists only intended Task 5 changes before commit.

- [ ] **Step 5: Verify rendered desktop and mobile pages**

Start `python -m http.server 4173` from the repository. Visit `index.html`, `works.html`, `contact.html`, and `about.html` through a browser at approximately `1440×1000` and `390×844`. Confirm no horizontal overflow, readable navigation, visible keyboard focus, correct About redirect, restrained motion, a static frame under reduced motion, and no console errors.

- [ ] **Step 6: Verify the image prohibition**

Run: `git ls-files | rg -i "Cosmo_effects|\.(png|jpe?g|webp|gif)$"`

Expected: no output.

- [ ] **Step 7: Commit documentation and final policy checks**

```bash
git add README.md tests/site-structure.test.mjs
git commit -m "docs: document cosmic portfolio workflow"
```

- [ ] **Step 8: Run the final clean verification**

Run: `npm test && git diff --check && git status --short`

Expected: all tests PASS, no whitespace errors, and a clean working tree.
